import { Link } from "react-router-dom";
import { Leaf, MapPin, Phone, Mail, Instagram, Facebook } from "lucide-react";

export default function Footer() {
  return (
    <footer className="mt-24 bg-[#1B4332] text-white" data-testid="site-footer">
      <div className="container-app py-16">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-[#1B4332]">
                <Leaf className="h-5 w-5" />
              </span>
              <span className="font-heading text-xl font-bold">Ambajogai Grocery</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-white/70">
              Your neighbourhood grocery store — bringing farm-fresh produce and daily essentials to your doorstep across Ambajogai.
            </p>
          </div>

          <div>
            <h4 className="font-heading text-sm font-semibold uppercase tracking-wider text-[#8BA888]">Shop</h4>
            <ul className="mt-4 space-y-2 text-sm">
              <li><Link to="/products" className="text-white/80 hover:text-white">All Products</Link></li>
              <li><Link to="/products?category=fruits-vegetables" className="text-white/80 hover:text-white">Fruits & Vegetables</Link></li>
              <li><Link to="/products?category=dairy-bakery" className="text-white/80 hover:text-white">Dairy & Bakery</Link></li>
              <li><Link to="/products?category=staples-grains" className="text-white/80 hover:text-white">Staples & Grains</Link></li>
              <li><Link to="/products?category=spices-masala" className="text-white/80 hover:text-white">Spices & Masala</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-heading text-sm font-semibold uppercase tracking-wider text-[#8BA888]">Company</h4>
            <ul className="mt-4 space-y-2 text-sm">
              <li><Link to="/about" className="text-white/80 hover:text-white">About us</Link></li>
              <li><Link to="/contact" className="text-white/80 hover:text-white">Contact</Link></li>
              <li><Link to="/orders" className="text-white/80 hover:text-white">Track Order</Link></li>
              <li><Link to="/privacy" className="text-white/80 hover:text-white">Privacy Policy</Link></li>
              <li><Link to="/terms" className="text-white/80 hover:text-white">Terms of Service</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-heading text-sm font-semibold uppercase tracking-wider text-[#8BA888]">Contact</h4>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex items-start gap-2 text-white/80">
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>Main Road, Ambajogai, Maharashtra 431517</span>
              </li>
              <li className="flex items-center gap-2 text-white/80">
                <Phone className="h-4 w-4" />
                <span>+91 99999 99999</span>
              </li>
              <li className="flex items-center gap-2 text-white/80">
                <Mail className="h-4 w-4" />
                <span>contact@ambajogai.com</span>
              </li>
            </ul>
            <div className="mt-4 flex gap-3">
              <a href="#" className="grid h-9 w-9 place-items-center rounded-full border border-white/20 text-white/80 hover:bg-white/10" aria-label="Instagram"><Instagram className="h-4 w-4" /></a>
              <a href="#" className="grid h-9 w-9 place-items-center rounded-full border border-white/20 text-white/80 hover:bg-white/10" aria-label="Facebook"><Facebook className="h-4 w-4" /></a>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 text-xs text-white/60 md:flex-row md:items-center">
          <p>© {new Date().getFullYear()} Ambajogai Grocery Store. All rights reserved.</p>
          <p>Made with care in Maharashtra</p>
        </div>
      </div>
    </footer>
  );
}
