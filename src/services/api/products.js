import api from '../api';

export const getProducts = () =>
    api.get('/product');

export const createProduct = (data) =>
    api.post('/product', data);

export const updateProduct = (id, data) =>
    api.patch(`/product/${id}`, data);

export const deleteProduct = (id) =>
    api.delete(`/product/${id}`);

export const getProductByBarcode = (barcode) =>
    api.get(`/product/barcode/${barcode}`);

export const getProductBySku = (sku) =>
    api.get(`/product/sku/${sku}`);

export const generateSku = () =>
    api.get('/product/generate-sku');

export const generateBarcode = () =>
    api.get('/product/generate-barcode');

// ─── Stock / Inventory ──────────────────────────────────────
export const updateStock = (id, data) =>
    api.patch(`/product/${id}/stock`, data);

export const bulkUpdateStock = (items) =>
    api.post('/product/bulk-stock', { items });

export const getLowStockProducts = () =>
    api.get('/product/low-stock');

export const getStockMovements = (params) =>
    api.get('/product/stock-movements', { params });

export const getInventoryValuation = () =>
    api.get('/product/report/valuation');

export const getDeadStock = (days) =>
    api.get('/product/report/dead-stock', { params: { days } });

export const getStockReport = (params) =>
    api.get('/product/report/stock', { params });
