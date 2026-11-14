import React, { createContext, useContext, useState, useEffect } from 'react';
import { getBusinessById } from '../services/api/business';
import { useTheme } from './ThemeContext';

const BusinessContext = createContext(null);

export const useBusiness = () => {
    const context = useContext(BusinessContext);
    if (!context) {
        throw new Error('useBusiness must be used within a BusinessProvider');
    }
    return context;
};

// Business type configurations
const businessConfigs = {
    restaurant: {
        type: 'restaurant',
        label: 'Restaurant',
        itemsLabel: 'Menu',
        staffLabel: 'Staff',
    },
    retail: {
        type: 'retail',
        label: 'Retail',
        itemsLabel: 'Products',
        staffLabel: 'Counter Users',
    },
    service: {
        type: 'service',
        label: 'Service',
        itemsLabel: 'Services',
        staffLabel: 'Staff',
    },
};

export const BusinessProvider = ({ children }) => {
    const [business, setBusiness] = useState(null);
    const [businessType, setBusinessType] = useState('retail');
    const [config, setConfig] = useState(businessConfigs.retail);
    const [loading, setLoading] = useState(true);
    const { setShopAppearance } = useTheme();

    useEffect(() => {
        loadBusiness();
    }, []);

    // The shop's accent colour / sidebar style (set by the admin in Settings → Appearance).
    // No business (logged out) or an older server without the field → the theme falls back.
    useEffect(() => {
        setShopAppearance(business?.settings?.appearance || null);
    }, [business, setShopAppearance]);

    // Helper to extract business type from various possible data structures
    const extractBusinessType = (businessData) => {
        // Try different possible structures:
        // 1. businessType.code (object with code)
        // 2. businessType (direct string)
        // 3. type (alternative field)
        if (businessData.businessType?.code) {
            return businessData.businessType.code;
        }
        if (typeof businessData.businessType === 'string') {
            return businessData.businessType;
        }
        if (businessData.type) {
            return businessData.type;
        }
        return 'retail'; // default fallback
    };

    const loadBusiness = () => {
        try {
            const businessStr = localStorage.getItem('business');
            if (businessStr) {
                const businessData = JSON.parse(businessStr);
                setBusiness(businessData);
                const type = extractBusinessType(businessData);
                setBusinessType(type);
                setConfig(businessConfigs[type] || businessConfigs.retail);
            }
        } catch (error) {
            console.error('Error loading business:', error);
        } finally {
            setLoading(false);
        }
    };

    const refreshBusiness = async () => {
        try {
            const businessId = business?._id || business?.id;
            if (!businessId) throw new Error('No business ID available');
            const response = await getBusinessById(businessId);
            const businessData = response.data;
            localStorage.setItem('business', JSON.stringify(businessData));
            setBusiness(businessData);
            const type = extractBusinessType(businessData);
            setBusinessType(type);
            setConfig(businessConfigs[type] || businessConfigs.retail);
            return businessData;
        } catch (error) {
            console.error('Error refreshing business:', error);
            throw error;
        }
    };

    const value = {
        business,
        businessType,
        config,
        loading,
        loadBusiness,
        refreshBusiness,
    };

    return (
        <BusinessContext.Provider value={value}>
            {children}
        </BusinessContext.Provider>
    );
};

export default BusinessContext;
