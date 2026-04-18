import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FiMail, FiLock, FiEye, FiEyeOff, FiUser, FiBriefcase, FiPhone, FiDollarSign, FiArrowLeft, FiArrowRight, FiCheck } from 'react-icons/fi';
import { getBusinessTypes, registerBusiness } from '../services/api/business';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';

const STEPS = ['Business Type', 'Business Info', 'Admin Account'];

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

    const typeIcons = {
        restaurant: '🍽️',
        retail: '🛒',
        service: '💼',
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4"
            style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
        >
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-white rounded-2xl shadow-lg mx-auto flex items-center justify-center mb-4">
                        <FiBriefcase size={40} className="text-indigo-500" />
                    </div>
                    <h1 className="text-3xl font-bold text-white">Create Account</h1>
                    <p className="text-white/80 mt-2">Set up your business in minutes</p>
                </div>

                {/* Step indicator */}
                <div className="flex items-center justify-center gap-2 mb-6">
                    {STEPS.map((label, i) => (
                        <div key={label} className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                                i < step ? 'bg-green-400 text-white' :
                                i === step ? 'bg-white text-indigo-600' :
                                'bg-white/30 text-white/70'
                            }`}>
                                {i < step ? <FiCheck size={16} /> : i + 1}
                            </div>
                            {i < STEPS.length - 1 && (
                                <div className={`w-8 h-0.5 ${i < step ? 'bg-green-400' : 'bg-white/30'}`} />
                            )}
                        </div>
                    ))}
                </div>
                <p className="text-center text-white/90 text-sm mb-4 font-medium">{STEPS[step]}</p>

                {/* Card */}
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm mb-6">
                            {error}
                        </div>
                    )}

                    {/* Step 0: Business Type */}
                    {step === 0 && (
                        <div className="space-y-3">
                            {loadingTypes ? (
                                <div className="flex justify-center py-8">
                                    <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : (
                                businessTypes.map(type => (
                                    <button
                                        key={type._id}
                                        type="button"
                                        onClick={() => update('businessTypeId', type._id)}
                                        className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center gap-4 ${
                                            form.businessTypeId === type._id
                                                ? 'border-indigo-500 bg-indigo-50'
                                                : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                        <span className="text-3xl">{typeIcons[type.code] || '📦'}</span>
                                        <div>
                                            <p className="font-semibold text-slate-800">{type.name}</p>
                                            {type.description && (
                                                <p className="text-sm text-slate-500">{type.description}</p>
                                            )}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    )}

                    {/* Step 1: Business Info */}
                    {step === 1 && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Business Name *</label>
                                <div className="relative">
                                    <FiBriefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        value={form.businessName}
                                        onChange={e => update('businessName', e.target.value)}
                                        placeholder="My Store"
                                        className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-800 placeholder-slate-400"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Business Email *</label>
                                <div className="relative">
                                    <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="email"
                                        value={form.businessEmail}
                                        onChange={e => update('businessEmail', e.target.value)}
                                        placeholder="business@example.com"
                                        className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-800 placeholder-slate-400"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
                                <div className="relative">
                                    <FiPhone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        value={form.businessPhone}
                                        onChange={e => update('businessPhone', e.target.value)}
                                        placeholder="+92 300 1234567"
                                        className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-800 placeholder-slate-400"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Currency</label>
                                    <div className="relative">
                                        <FiDollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            value={form.currency}
                                            onChange={e => update('currency', e.target.value)}
                                            placeholder="PKR"
                                            className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-800 placeholder-slate-400"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Tax Rate %</label>
                                    <input
                                        type="number"
                                        value={form.taxRate}
                                        onChange={e => update('taxRate', e.target.value)}
                                        min="0"
                                        max="100"
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-800 placeholder-slate-400"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Admin Account */}
                    {step === 2 && (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Your Name *</label>
                                <div className="relative">
                                    <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        value={form.adminName}
                                        onChange={e => update('adminName', e.target.value)}
                                        placeholder="John Doe"
                                        className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-800 placeholder-slate-400"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Admin Email *</label>
                                <div className="relative">
                                    <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="email"
                                        value={form.adminEmail}
                                        onChange={e => update('adminEmail', e.target.value)}
                                        placeholder="admin@example.com"
                                        className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-800 placeholder-slate-400"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Password * (min 8 chars)</label>
                                <div className="relative">
                                    <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={form.adminPassword}
                                        onChange={e => update('adminPassword', e.target.value)}
                                        placeholder="Enter password"
                                        className="w-full pl-12 pr-12 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-800 placeholder-slate-400"
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                        {showPassword ? <FiEyeOff /> : <FiEye />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Confirm Password *</label>
                                <div className="relative">
                                    <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type={showConfirm ? 'text' : 'password'}
                                        value={form.confirmPassword}
                                        onChange={e => update('confirmPassword', e.target.value)}
                                        placeholder="Confirm password"
                                        className="w-full pl-12 pr-12 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-800 placeholder-slate-400"
                                    />
                                    <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                        {showConfirm ? <FiEyeOff /> : <FiEye />}
                                    </button>
                                </div>
                            </div>

                            {/* Submit button (hidden, form submits via the Next/Create button below) */}
                            <button type="submit" className="hidden" />
                        </form>
                    )}

                    {/* Navigation buttons */}
                    <div className="flex items-center justify-between mt-8">
                        {step > 0 ? (
                            <button onClick={prevStep}
                                className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors">
                                <FiArrowLeft /> Back
                            </button>
                        ) : (
                            <div />
                        )}

                        {step < 2 ? (
                            <button onClick={nextStep}
                                className="flex items-center gap-2 px-6 py-3 bg-indigo-500 text-white font-semibold rounded-xl hover:bg-indigo-600 transition-colors">
                                Next <FiArrowRight />
                            </button>
                        ) : (
                            <button
                                onClick={handleSubmit}
                                disabled={loading}
                                className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white font-semibold rounded-xl hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    <>Create Account <FiCheck /></>
                                )}
                            </button>
                        )}
                    </div>

                    {/* Login link */}
                    <div className="mt-6 pt-6 border-t border-slate-200 text-center">
                        <Link to="/login" className="text-sm text-indigo-500 hover:text-indigo-700 font-medium transition-colors">
                            Already have an account? Sign in
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Signup;
