export interface CartItem {
  id: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
}

export type PaymentMethod = 'Efectivo' | 'Tarjeta' | 'Transferencia' | 'Credito' | 'Cheque';

export interface PosStation {
  id: string;
  name: string;
  warehouse_id: string;
  warehouse_name?: string;
  station_role?: 'EMISORA_PRINCIPAL' | 'PREFACTURACION_ONLY';
}

export interface TabItem {
  id: string;
  key: string;
}
