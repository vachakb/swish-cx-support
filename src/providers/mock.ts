import * as repo from '../repositories';
import type { OrdersProvider, TrackingProvider, WalletProvider } from './types';

export const mockOrders: OrdersProvider = {
  getCustomer: repo.getCustomer,
  getOrder: repo.getOrder,
  getOrderDetails: repo.getOrderDetails,
  listOrdersByCustomer: repo.listOrdersByCustomer,
};

export const mockTracking: TrackingProvider = {
  getTracking: repo.getTracking,
};

export const mockWallet: WalletProvider = {
  getWallet: repo.getWallet,
};
