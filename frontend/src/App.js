import PanelChrome from "@/components/PanelChrome";
import ScrollToTop from "@/components/ScrollToTop";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import Header from "@/components/Header";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import StickyCartBar from "@/components/StickyCartBar";
import ProtectedRoute from "@/components/ProtectedRoute";

import Home from "@/pages/Home";
import Products from "@/pages/Products";
import VendorDashboard from "./pages/VendorDashboard";
import ProductDetail from "@/pages/ProductDetail";
import Cart from "@/pages/Cart";
import Checkout from "@/pages/Checkout";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import Orders from "@/pages/Orders";
import OrderDetail from "@/pages/OrderDetail";
import About from "@/pages/About";
import Contact from "@/pages/Contact";
import Legal from "@/pages/Legal";
import Admin from "@/pages/Admin";
import BecomeVendor from "@/pages/BecomeVendor";
import Profile from "@/pages/Profile";
import { ProfileComingSoon } from "@/pages/ProfileSection";
import ProfileRefer from "@/pages/ProfileRefer";
import ProfileNotifications from "@/pages/ProfileNotifications";
import ProfileRate from "@/pages/ProfileRate";

import VendorStorefront from "@/pages/VendorStorefront";
import DeliveryPanel from "@/pages/DeliveryPanel";

import "@/App.css";

function AppShell() {
  const location = useLocation();
  const isPanelRoute = /^\/(admin|vendor|delivery)(\/|$)/.test(location.pathname);
  const hideStickyCart = /^\/(cart|checkout)(\/|$)/.test(location.pathname);

  return (
    <>
      <ScrollToTop />
      <div className="App flex min-h-screen flex-col">
        {isPanelRoute ? (
          <PanelChrome
            title={
              location.pathname.startsWith("/admin")
                ? "Admin Panel"
                : location.pathname.startsWith("/vendor")
                  ? "Vendor Panel"
                  : "Delivery Panel"
            }
          />
        ) : (
          <Header />
        )}
        <main className={`flex-1 ${isPanelRoute ? "pb-6" : "pb-20 sm:pb-6"}`}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/products" element={<Products />} />
            <Route path="/products/:slug" element={<ProductDetail />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/privacy" element={<Legal type="privacy" />} />
            <Route path="/terms" element={<Legal type="terms" />} />
            <Route
              path="/checkout"
              element={
                <ProtectedRoute>
                  <Checkout />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders"
              element={
                <ProtectedRoute>
                  <Orders />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders/:id"
              element={
                <ProtectedRoute>
                  <OrderDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile/wishlist"
              element={
                <ProtectedRoute>
                  <ProfileComingSoon
                    title="Wishlist"
                    description="Save your favourite products for later."
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile/wallet"
              element={
                <ProtectedRoute>
                  <ProfileComingSoon
                    title="Wallet"
                    description="Store credit and refunds will appear here."
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile/refer"
              element={
                <ProtectedRoute>
                  <ProfileRefer />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile/notifications"
              element={
                <ProtectedRoute>
                  <ProfileNotifications />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile/rate"
              element={
                <ProtectedRoute>
                  <ProfileRate />
                </ProtectedRoute>
              }
            />
            <Route path="/become-vendor" element={<BecomeVendor />} />
            <Route path="/vendors/:id" element={<VendorStorefront />} />
            <Route
              path="/vendor/*"
              element={
                <ProtectedRoute vendorOnly>
                  <VendorDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/delivery/*"
              element={
                <ProtectedRoute deliveryOnly>
                  <DeliveryPanel />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/*"
              element={
                <ProtectedRoute adminOnly>
                  <Admin />
                </ProtectedRoute>
              }
            />
          </Routes>
        </main>
        {!isPanelRoute && <WhatsAppFloat />}
        {!isPanelRoute && !hideStickyCart && <StickyCartBar />}
        <Toaster position="top-right" richColors closeButton />
      </div>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <AppShell />
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}
