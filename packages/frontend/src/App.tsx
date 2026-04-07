import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import AppLayout from './components/Layout/AppLayout';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import MerchantList from './pages/MerchantList';
import MerchantNew from './pages/MerchantNew';
import MerchantDetail from './pages/MerchantDetail';
import SetupPayments from './pages/SetupPayments';
import Settings from './pages/Settings';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/merchants" element={<MerchantList />} />
            <Route path="/merchants/new" element={<MerchantNew />} />
            <Route path="/merchants/:id" element={<MerchantDetail />} />
            <Route path="/merchants/:id/setup-payments" element={<SetupPayments />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
