import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import AppLayout from './components/Layout/AppLayout';
import Home from './pages/Home';
import MerchantNew from './pages/MerchantNew';
import MerchantDetail from './pages/MerchantDetail';
import SetupPayments from './pages/SetupPayments';
import PayoutManagement from './pages/PayoutManagement';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/merchants/new" element={<MerchantNew />} />
            <Route path="/merchants/:id" element={<MerchantDetail />} />
            <Route path="/merchants/:id/setup-payments" element={<SetupPayments />} />
            <Route path="/merchants/:id/payouts" element={<PayoutManagement />} />
            <Route path="/merchant" element={<MerchantDetail />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
