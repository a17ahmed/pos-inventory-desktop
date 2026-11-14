import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FiEye, FiEyeOff, FiArrowLeft, FiArrowRight, FiCheck, FiShoppingCart, FiCoffee, FiBriefcase, FiPackage } from 'react-icons/fi';
import { AuthLayout, AuthCard, BrandMark } from '../components/shell/AuthLayout';
import { Button, IconButton, Field, Input, Alert, Skeleton, cn } from '../components/ui';
import { getBusinessTypes, registerBusiness } from '../services/api/business';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';

const STEPS = ['Kind of shop', 'Shop details', 'Your account'];

const Signup = () => {
    const navigate = useNavigate();
    const { checkAuth } = useAuth();
    const { loadBusiness } = useBusiness();

    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [businessTypes, setBusinessTypes] = useState([]);
    const [loadingTypes, setLoadingTypes] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    // Form state
    const [form, setForm] = useState({
        businessTypeId: '',
        businessName: '',
        businessEmail: '',
        businessPhone: '',
        currency: 'PKR',
        taxRate: 0,
        adminName: '',
        adminEmail: '',
        adminPassword: '',
        confirmPassword: '',
    });

    useEffect(() => {
        const fetchTypes = async () => {
            try {
                const res = await getBusinessTypes();
                setBusinessTypes(res.data || []);
            } catch (err) {
                console.error('Error fetching business types:', err);
                setError('Failed to load business types');
            } finally {
                setLoadingTypes(false);
            }
        };
        fetchTypes();
    }, []);

    const update = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
        setError('');
    };

    const validateStep = () => {
        if (step === 0) {
            if (!form.businessTypeId) {
                setError('Please select a business type');
                return false;
            }
        } else if (step === 1) {
            if (!form.businessName.trim()) { setError('Business name is required'); return false; }
            if (!form.businessEmail.trim()) { setError('Business email is required'); return false; }
        } else if (step === 2) {
            if (!form.adminName.trim()) { setError('Your name is required'); return false; }
            if (!form.adminEmail.trim()) { setError('Your email is required'); return false; }
            if (!form.adminPassword) { setError('Password is required'); return false; }
            if (form.adminPassword.length < 8) { setError('Password must be at least 8 characters'); return false; }
            if (form.adminPassword !== form.confirmPassword) { setError('Passwords do not match'); return false; }
        }
        return true;
    };

    const nextStep = () => {
        if (validateStep()) {
            setStep(prev => prev + 1);
            setError('');
        }
    };

    const prevStep = () => {
        setStep(prev => prev - 1);
        setError('');
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!validateStep()) return;

        setLoading(true);
        setError('');
        try {
            const response = await registerBusiness({
                businessName: form.businessName.trim(),
                businessTypeId: form.businessTypeId,
                businessEmail: form.businessEmail.trim(),
                businessPhone: form.businessPhone.trim(),
                currency: form.currency,
                taxRate: Number(form.taxRate) || 0,
                adminName: form.adminName.trim(),
                adminEmail: form.adminEmail.trim(),
                adminPassword: form.adminPassword,
            });

            const { token, admin, business } = response.data;

            // Auto-login
            localStorage.setItem('token', token);
            if (admin) {
                localStorage.setItem('admin', JSON.stringify(admin));
                localStorage.setItem('user', JSON.stringify(admin));
            }
            if (business) {
                localStorage.setItem('business', JSON.stringify(business));
            }

            checkAuth();
            loadBusiness();
            navigate('/dashboard', { replace: true });
        } catch (err) {
            console.error('Registration error:', err);
            setError(err.response?.data?.message || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const selectedType = businessTypes.find(t => t._id === form.businessTypeId);

    const typeIcons = { restaurant: FiCoffee, retail: FiShoppingCart, service: FiBriefcase };

    const pw = (key, show, setShow, label, autoComplete) => (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={`su-${key}`} className="text-body-sm font-medium text-foreground">
                {label}
            </label>
            <div className="relative">
                <Input
                    id={`su-${key}`}
                    type={show ? 'text' : 'password'}
                    autoComplete={autoComplete}
                    value={form[key]}
                    onChange={(e) => update(key, e.target.value)}
                    className="w-full pr-11"
                />
                <IconButton
                    size="2xs"
                    label={show ? 'Hide password' : 'Show password'}
                    onClick={() => setShow(!show)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2"
                >
                    {show ? <FiEyeOff /> : <FiEye />}
                </IconButton>
            </div>
        </div>
    );

    return (
        <AuthLayout
            footer={
                <Link to="/login" className="text-body font-medium text-primary hover:underline">
                    Already have a shop? Sign in
                </Link>
            }
        >
            <div className="mb-5 flex items-center gap-3">
                <BrandMark />
                <span className="font-heading text-h3 text-foreground">POS Desktop</span>
            </div>

            <AuthCard>
                <p className="font-mono text-overline-lg uppercase text-muted-foreground">
                    Step {step + 1} of {STEPS.length}
                </p>
                <h1 className="mt-1 font-heading text-h2 text-foreground">{STEPS[step]}</h1>
                <div className="mt-3 flex gap-1.5" aria-hidden="true">
                    {STEPS.map((label, i) => (
                        <span key={label} className={cn('h-1 flex-1 rounded-full', i <= step ? 'bg-primary' : 'bg-muted')} />
                    ))}
                </div>

                <div className="mt-5 flex flex-col gap-4">
                    {error ? <Alert tone="destructive">{error}</Alert> : null}

                    {step === 0 &&
                        (loadingTypes ? (
                            <div className="flex flex-col gap-2">
                                <Skeleton className="h-16 w-full" />
                                <Skeleton className="h-16 w-full" />
                                <Skeleton className="h-16 w-full" />
                            </div>
                        ) : (
                            <div role="radiogroup" aria-label="Kind of shop" className="flex flex-col gap-2">
                                {businessTypes.map((type) => {
                                    const Icon = typeIcons[type.code] || FiPackage;
                                    const active = form.businessTypeId === type._id;
                                    return (
                                        <button
                                            key={type._id}
                                            type="button"
                                            role="radio"
                                            aria-checked={active}
                                            onClick={() => update('businessTypeId', type._id)}
                                            className={cn(
                                                'w-full flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left',
                                                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                                                active ? 'border-primary bg-accent' : 'border-border bg-card hover:bg-[var(--hover-overlay)]'
                                            )}
                                        >
                                            <span className={cn('w-9 h-9 flex-none rounded-xl inline-flex items-center justify-center', active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                                                <Icon className="w-4 h-4" aria-hidden="true" />
                                            </span>
                                            <span className="flex-1 min-w-0">
                                                <span className="block text-body-lg font-medium text-foreground">{type.name}</span>
                                                {type.description ? <span className="block text-body-sm text-muted-foreground">{type.description}</span> : null}
                                            </span>
                                            {active ? <FiCheck className="w-4 h-4 text-primary" aria-hidden="true" /> : null}
                                        </button>
                                    );
                                })}
                            </div>
                        ))}

                    {step === 1 && (
                        <>
                            <Field label="Shop name" required>
                                <Input autoFocus value={form.businessName} onChange={(e) => update('businessName', e.target.value)} placeholder="My Store" />
                            </Field>
                            <Field label="Shop email" required>
                                <Input type="email" value={form.businessEmail} onChange={(e) => update('businessEmail', e.target.value)} placeholder="shop@example.com" />
                            </Field>
                            <Field label="Phone" optional>
                                <Input type="tel" value={form.businessPhone} onChange={(e) => update('businessPhone', e.target.value)} placeholder="+92 300 1234567" />
                            </Field>
                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Currency">
                                    <Input value={form.currency} onChange={(e) => update('currency', e.target.value.toUpperCase())} placeholder="PKR" maxLength={5} />
                                </Field>
                                <Field label="Tax rate" hint="%">
                                    <Input type="number" min="0" max="100" value={form.taxRate} onChange={(e) => update('taxRate', e.target.value)} />
                                </Field>
                            </div>
                        </>
                    )}

                    {step === 2 && (
                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            <Field label="Your name" required>
                                <Input autoFocus autoComplete="name" value={form.adminName} onChange={(e) => update('adminName', e.target.value)} placeholder="John Doe" />
                            </Field>
                            <Field label="Your email" required hint="You'll sign in with this.">
                                <Input type="email" autoComplete="username" value={form.adminEmail} onChange={(e) => update('adminEmail', e.target.value)} placeholder="you@example.com" />
                            </Field>
                            {pw('adminPassword', showPassword, setShowPassword, 'Password (at least 8 characters)', 'new-password')}
                            {pw('confirmPassword', showConfirm, setShowConfirm, 'Password again', 'new-password')}
                            <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
                        </form>
                    )}
                </div>

                <div className="mt-6 flex items-center justify-between gap-3">
                    {step > 0 ? (
                        <Button variant="ghost" onClick={prevStep} disabled={loading}>
                            <FiArrowLeft aria-hidden="true" />
                            Back
                        </Button>
                    ) : (
                        <span />
                    )}
                    {step < 2 ? (
                        <Button onClick={nextStep}>
                            Next
                            <FiArrowRight aria-hidden="true" />
                        </Button>
                    ) : (
                        <Button onClick={handleSubmit} loading={loading}>
                            {loading ? 'Creating…' : 'Create shop'}
                        </Button>
                    )}
                </div>
            </AuthCard>
        </AuthLayout>
    );
};

export default Signup;
