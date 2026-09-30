// @ts-nocheck
import React, { useState, useMemo, useContext, createContext, useEffect, useRef } from 'react';
import api, { imageUrl } from './api.js';
import { openCustomerDisplay, CHANNEL_NAME } from './customerDisplay.js';
// Loaded on demand (see ClockInCameraModal) — face-api.js drags in
// TensorFlow.js, which roughly doubles the JS bundle. Nothing else in the
// app needs it, so it shouldn't cost every page load just to sit unused.
import {
  ToastProvider, useToast, DataProvider, useData, Modal, Field, Input,
  ProductForm, SupplierForm, UserForm, EmployeeForm, POForm,
  downloadCsv, downloadJson, PrimaryBtn, GhostBtn,
  AuthProvider, useAuth, LoginScreen, PlatformLogin, switchShop,
} from './shared.jsx';
import { getTenantToken } from './api.js';
import {
  ShoppingCart, Package, Users, BarChart3, Settings,
  Search, Scan, Plus, Minus, X, CreditCard, Banknote, Smartphone,
  Bell, TrendingUp, AlertTriangle, CheckCircle2,
  Receipt, FileText, ChevronRight, Download,
  Apple, Beef, Milk, Cookie, Wine, Sparkles, Coffee, Wheat,
  ArrowUpRight, ArrowDownRight, Calendar, Star, Award, Zap,
  Building2, MapPin, Trash2, LayoutGrid, LogOut, HelpCircle,
  Clock, UserCircle2, Printer, Wallet, Truck, ClipboardList,
  ArrowDownLeft, ArrowUpLeft, RefreshCw, Languages, Phone, Mail,
  Globe, Building, Hash, Percent, ShieldCheck, BellRing,
  Save, Eye, EyeOff, ChevronLeft, Edit2, Send, FileCheck, Camera, Monitor, Home,
  MessageCircle, ArrowUpDown,
  Shirt, Layers, SquareStack, Medal, Shapes, Columns,
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

// ============ TRANSLATIONS ============
const TRANSLATIONS = {
  en: {
    // Nav
    home: 'Home', checkout: 'Checkout', dashboard: 'Dashboard', inventory: 'Inventory',
    shifts: 'Shifts',
    go_checkout: 'Check Out', welcome_back: 'Welcome back', sub_home: 'Pick a category or jump straight to checkout',
    good_morning: 'Good morning', good_afternoon: 'Good afternoon', good_evening: 'Good evening', of_sales: 'of sales',
    customers: 'Customers', stores: 'Stores', reports: 'Reports', expenses: 'Expenses',
    manualSale: 'Record Sale',
    settings: 'Settings', help: 'Help',
    // Subtitles
    sub_pos: 'New order · Cashier station 03',
    sub_dash: 'Overview of all your stores',
    sub_inv: '2,847 products · 14 alerts',
    sub_cust: '1,248 customers · 864 loyalty members',
    sub_reports: 'Sales, inventory and accounting exports',
    sub_settings: 'Configure your business and POS',
    sub_shifts: 'Track employee clock-in and clock-out',
    // POS
    search_products: 'Search products or SKU...',
    scan: 'Scan', all_items: 'All Items',
    sets: 'Sets', jerseys: 'Jerseys', trousers: 'Trousers', pullovers: 'Pullovers',
    shirts: 'Shirts', shorts: 'Shorts', tshirts: 'T-Shirts', others: 'Others',
    customer: 'Customer', add_customer: 'Add customer', add: 'Add',
    walk_in_customer: 'Walk-In Customer', no_loyalty_account: 'No loyalty account',
    order: 'Order', items: 'items', clear: 'Clear',
    cart_empty: 'Cart is empty', tap_to_add: 'Tap products to add',
    subtotal: 'Subtotal', total: 'Total',
    earns: 'Earns', pts: 'pts',
    cash: 'Cash', card: 'Card', mobile: 'Mobile',
    complete_payment: 'Complete Payment', payment_received: 'Payment received',
    total_paid: 'Total paid', method: 'Method',
    print: 'Print', new_order: 'New order', view_receipt: 'View receipt',
    in_stock: 'in stock', low: 'Low',
    // KPIs / Dashboard
    todays_sales: "Today's Sales", orders: 'Orders',
    low_stock_items: 'Low stock items',
    by_category: 'By category', share_of_sales: 'Share of sales',
    view_report: 'View report',
    // Inventory tabs
    products: 'Products', suppliers: 'Suppliers',
    purchase_orders: 'Purchase Orders', stock_movements: 'Stock Movements',
    total_skus: 'Total SKUs', stock_value: 'Stock value',
    out_of_stock: 'Out of stock', low_stock: 'Low stock',
    all: 'All', export: 'Export', add_product: 'Add product',
    product: 'Product', category: 'Category', price: 'Price',
    stock: 'Stock', status: 'Status', edit: 'Edit',
    sort_by: 'Sort by', sort_date_modified: 'Date modified (newest)',
    sort_date_registered: 'Date registered (newest)', sort_name_az: 'Name (A–Z)',
    sort_name_za: 'Name (Z–A)', sort_stock_high: 'Stock (high–low)',
    sort_stock_low: 'Stock (low–high)', sort_price_high: 'Price (high–low)',
    sort_price_low: 'Price (low–high)',
    // Suppliers
    add_supplier: 'Add supplier', supplier: 'Supplier',
    contact: 'Contact', products_count: 'Products', last_order: 'Last order',
    active: 'Active', inactive: 'Inactive',
    // Purchase Orders
    create_po: 'Create PO', po_number: 'PO Number',
    order_date: 'Date', total_amount: 'Total', draft: 'Draft',
    sent: 'Sent', in_transit: 'In transit', received: 'Received',
    cancelled: 'Cancelled',
    // Stock movements
    stock_in: 'Stock in', stock_out: 'Stock out', adjustment: 'Adjustment',
    type: 'Type', quantity: 'Qty', source: 'Source',
    date_time: 'Date & time', user: 'User',
    // Customers
    total_customers: 'Total Customers', loyalty_members: 'Loyalty Members',
    avg_visit: 'Avg. Visit Value', retention: 'Retention',
    tier: 'Tier', visits: 'Visits',
    lifetime_value: 'Lifetime Value', view_all: 'View all',
    recent_customers: 'Recent customers', top_spenders: 'Top spenders this month',
    // Reports
    sales_report: 'Sales Report', sales_report_desc: 'Daily, weekly, and monthly breakdowns',
    inv_report: 'Inventory Report', inv_report_desc: 'Stock levels, movement, and valuation',
    generate: 'Generate', export_pdf: 'Export PDF',
    revenue_trend: 'Revenue & orders trend', past_7_days: 'Past 7 days',
    integrations: 'Integrations', connected: 'Connected',
    // Settings tabs
    s_general: 'General', s_business: 'Business', s_receipt: 'Receipt',
    s_tax: 'Tax', s_payments: 'Payments',
    s_users: 'Users', s_notifications: 'Notifications',
    save_changes: 'Save changes', cancel: 'Cancel',
    business_name: 'Business name', currency: 'Currency',
    language: 'Language', timezone: 'Timezone', date_format: 'Date format',
    address: 'Address', phone: 'Phone', email: 'Email', website: 'Website',
    rccm: 'RCCM number', niu: 'NIU (Tax ID)',
    receipt_header: 'Receipt header', receipt_footer: 'Receipt footer',
    paper_width: 'Paper width', show_logo: 'Show logo on receipt',
    show_qr: 'Show QR code',
    tax_id_print: 'Print tax ID on receipts',
    accept_cash: 'Accept cash', accept_card: 'Accept cards',
    accept_mobile: 'Accept mobile money',
    role: 'Role', permissions: 'Permissions', last_active: 'Last active',
    admin: 'Admin', manager: 'Manager', cashier: 'Cashier',
    low_stock_threshold: 'Low stock threshold',
    daily_summary: 'Daily summary email',
    weekly_summary: 'Weekly performance report',
    payment_alerts: 'Failed payment alerts',
    // Receipt modal
    receipt: 'Receipt', original: 'Original',
    cashier_label: 'Cashier', station_label: 'Station', invoice: 'Invoice',
    items_label: 'Items', qty_label: 'Qty', price_label: 'Price',
    paid: 'Paid', change: 'Change',
    thank_you: 'Thank you for shopping with us',
    visit_again: 'See you soon!',
    close: 'Close',
  },
  fr: {
    home: 'Accueil', checkout: 'Caisse', dashboard: 'Tableau de bord', inventory: 'Inventaire',
    shifts: 'Équipes',
    go_checkout: 'Passer en caisse', welcome_back: 'Bon retour', sub_home: 'Choisissez une catégorie ou passez directement en caisse',
    good_morning: 'Bonjour', good_afternoon: 'Bon après-midi', good_evening: 'Bonsoir', of_sales: 'des ventes',
    customers: 'Clients', stores: 'Magasins', reports: 'Rapports', expenses: 'Dépenses',
    manualSale: 'Vente manuelle',
    settings: 'Paramètres', help: 'Aide',
    sub_pos: 'Nouvelle commande · Caisse 03',
    sub_dash: 'Vue d\'ensemble de vos magasins',
    sub_inv: '2 847 produits · 14 alertes',
    sub_cust: '1 248 clients · 864 membres fidélité',
    sub_reports: 'Exports ventes, inventaire et comptabilité',
    sub_settings: 'Configurez votre entreprise et la caisse',
    sub_shifts: 'Suivez les arrivées et départs des employés',
    search_products: 'Rechercher produit ou SKU...',
    scan: 'Scanner', all_items: 'Tous',
    sets: 'Ensembles', jerseys: 'Maillots', trousers: 'Pantalons', pullovers: 'Pulls',
    shirts: 'Chemises', shorts: 'Shorts', tshirts: 'T-Shirts', others: 'Autres',
    customer: 'Client', add_customer: 'Ajouter client', add: 'Ajouter',
    walk_in_customer: 'Client de passage', no_loyalty_account: 'Pas de compte fidélité',
    order: 'Commande', items: 'articles', clear: 'Vider',
    cart_empty: 'Panier vide', tap_to_add: 'Touchez un produit pour l\'ajouter',
    subtotal: 'Sous-total', total: 'Total',
    earns: 'Gagne', pts: 'pts',
    cash: 'Espèces', card: 'Carte', mobile: 'Mobile',
    complete_payment: 'Valider le paiement', payment_received: 'Paiement reçu',
    total_paid: 'Total payé', method: 'Mode',
    print: 'Imprimer', new_order: 'Nouvelle commande', view_receipt: 'Voir le reçu',
    in_stock: 'en stock', low: 'Bas',
    todays_sales: "Ventes du jour", orders: 'Commandes',
    low_stock_items: 'Stock bas',
    by_category: 'Par catégorie', share_of_sales: 'Part des ventes',
    view_report: 'Voir le rapport',
    products: 'Produits', suppliers: 'Fournisseurs',
    purchase_orders: 'Bons de commande', stock_movements: 'Mouvements de stock',
    total_skus: 'Total SKU', stock_value: 'Valeur stock',
    out_of_stock: 'Rupture', low_stock: 'Stock bas',
    all: 'Tous', export: 'Exporter', add_product: 'Ajouter produit',
    product: 'Produit', category: 'Catégorie', price: 'Prix',
    stock: 'Stock', status: 'Statut', edit: 'Modifier',
    sort_by: 'Trier par', sort_date_modified: 'Date de modification (récent)',
    sort_date_registered: "Date d'enregistrement (récent)", sort_name_az: 'Nom (A–Z)',
    sort_name_za: 'Nom (Z–A)', sort_stock_high: 'Stock (élevé–bas)',
    sort_stock_low: 'Stock (bas–élevé)', sort_price_high: 'Prix (élevé–bas)',
    sort_price_low: 'Prix (bas–élevé)',
    add_supplier: 'Ajouter fournisseur', supplier: 'Fournisseur',
    contact: 'Contact', products_count: 'Produits', last_order: 'Dernière cmd.',
    active: 'Actif', inactive: 'Inactif',
    create_po: 'Créer bon', po_number: 'N° Bon',
    order_date: 'Date', total_amount: 'Total', draft: 'Brouillon',
    sent: 'Envoyé', in_transit: 'En transit', received: 'Reçu',
    cancelled: 'Annulé',
    stock_in: 'Entrée', stock_out: 'Sortie', adjustment: 'Ajustement',
    type: 'Type', quantity: 'Qté', source: 'Source',
    date_time: 'Date & heure', user: 'Utilisateur',
    total_customers: 'Total Clients', loyalty_members: 'Membres Fidélité',
    avg_visit: 'Panier moyen', retention: 'Fidélisation',
    tier: 'Niveau', visits: 'Visites',
    lifetime_value: 'Valeur à vie', view_all: 'Tout voir',
    recent_customers: 'Clients récents', top_spenders: 'Plus gros acheteurs ce mois',
    sales_report: 'Rapport de ventes', sales_report_desc: 'Décomposition quotidienne, hebdomadaire et mensuelle',
    inv_report: 'Rapport inventaire', inv_report_desc: 'Niveaux, mouvements et valorisation',
    generate: 'Générer', export_pdf: 'Exporter PDF',
    revenue_trend: 'Tendance recettes & commandes', past_7_days: '7 derniers jours',
    integrations: 'Intégrations', connected: 'Connecté',
    s_general: 'Général', s_business: 'Entreprise', s_receipt: 'Reçu',
    s_tax: 'Taxes', s_payments: 'Paiements',
    s_users: 'Utilisateurs', s_notifications: 'Notifications',
    save_changes: 'Enregistrer', cancel: 'Annuler',
    business_name: 'Nom de l\'entreprise', currency: 'Devise',
    language: 'Langue', timezone: 'Fuseau horaire', date_format: 'Format de date',
    address: 'Adresse', phone: 'Téléphone', email: 'E-mail', website: 'Site web',
    rccm: 'Numéro RCCM', niu: 'NIU (Identifiant fiscal)',
    receipt_header: 'En-tête du reçu', receipt_footer: 'Pied du reçu',
    paper_width: 'Largeur du papier', show_logo: 'Afficher le logo',
    show_qr: 'Afficher le QR code',
    tax_id_print: 'Imprimer NIU sur les reçus',
    accept_cash: 'Accepter espèces', accept_card: 'Accepter cartes',
    accept_mobile: 'Accepter mobile money',
    role: 'Rôle', permissions: 'Permissions', last_active: 'Actif',
    admin: 'Administrateur', manager: 'Gestionnaire', cashier: 'Caissier',
    low_stock_threshold: 'Seuil stock bas',
    daily_summary: 'Résumé quotidien par e-mail',
    weekly_summary: 'Rapport hebdomadaire',
    payment_alerts: 'Alertes échec de paiement',
    receipt: 'Reçu', original: 'Original',
    cashier_label: 'Caissier', station_label: 'Caisse', invoice: 'Facture',
    items_label: 'Articles', qty_label: 'Qté', price_label: 'Prix',
    paid: 'Payé', change: 'Monnaie',
    thank_you: 'Merci de votre visite',
    visit_again: 'À bientôt !',
    close: 'Fermer',
  }
};

const LangContext = createContext({ lang: 'en', t: (k) => k, setLang: () => {} });
const useT = () => useContext(LangContext);

// ============ SHIFT CONTEXT ============
const DEFAULT_EMPLOYEES = [
  { id: 1, name: 'Mariama Ndiaye', role: 'Salesperson', initials: 'MN', color: 'from-amber-400 to-rose-500' },
  { id: 2, name: 'Awa Sow', role: 'Salesperson', initials: 'AS', color: 'from-sky-400 to-indigo-600' },
  { id: 3, name: 'Chantal Biya', role: 'Salesperson', initials: 'CB', color: 'from-fuchsia-400 to-purple-600' },
  { id: 4, name: 'Ibrahim Bah', role: 'Stocker', initials: 'IB', color: 'from-emerald-400 to-teal-600' },
];

const ShiftContext = createContext(null);
const useShifts = () => useContext(ShiftContext);

// ============ ROLE / PERMISSIONS ============
// admin      -> full access (finances, inventory cost/margin, users, settings, reports)
// manager    -> operations: dashboard, inventory (edit existing, no new SKUs), customers, stores,
//               shifts (no finance/cost, no checkout — that's a cashier-till job)
// cashier    -> pos + own shift only
// accountant -> read-only finance role: dashboard, inventory (no edit), customers, reports
//               with cost/margin + accounting, shifts (view), expenses. NO checkout, NO edits.
// addProducts is split out from editInventory: it gates only onboarding brand-new SKUs
// ("Add product" / "Scan to add"), so a manager can still fix stock counts or correct an
// existing listing without being the one who adds new catalog items.
const ROLE_ACCESS = {
  admin:   { home: true, pos: true, dashboard: true, inventory: true, customers: true, reports: true, shifts: true, settings: true, expenses: true, manualSale: true,
             seeCost: true, seeFinance: true, seeUsers: true, editInventory: true, addProducts: true, seeCustomerPII: true, seeAllShifts: true, readOnly: false, admin: true },
  manager: { home: true, pos: false, dashboard: true, inventory: true, customers: true, reports: true, shifts: true, settings: false, expenses: true, manualSale: true,
             seeCost: false, seeFinance: false, seeUsers: false, editInventory: true, addProducts: false, seeCustomerPII: true, seeAllShifts: true, readOnly: false },
  cashier: { home: true, pos: true, dashboard: false, inventory: false, customers: false, reports: false, shifts: true, settings: false, expenses: false, manualSale: false,
             seeCost: false, seeFinance: false, seeUsers: false, editInventory: false, addProducts: false, seeCustomerPII: false, seeAllShifts: false, readOnly: false },
  accountant: { home: false, pos: false, dashboard: true, inventory: true, customers: true, reports: true, shifts: true, settings: false, expenses: true, manualSale: false,
             seeCost: true, seeFinance: true, seeUsers: false, editInventory: false, addProducts: false, seeCustomerPII: true, seeAllShifts: true, readOnly: true },
};
const RoleContext = createContext(null);
const useRole = () => useContext(RoleContext);
const RoleProvider = ({ children }) => {
  const { user } = useAuth();
  const [role, setRole] = useState(user?.role || 'cashier');
  // Keep the active role in step with whoever is logged in.
  useEffect(() => { if (user?.role) setRole(user.role); }, [user]);
  const can = ROLE_ACCESS[role];
  return <RoleContext.Provider value={{ role, setRole, can }}>{children}</RoleContext.Provider>;
};

// Store location context — only meaningful when Settings > "Enable multiple
// stores" is on (see settings.multiStore). Off = everyone implicitly works
// from a single store (whatever the logged-in user's storeId is, or the
// first store on record), exactly like the app behaved before this existed.
const StoreContext = createContext(null);
const useStore = () => useContext(StoreContext);
const StoreProvider = ({ children }) => {
  const { user } = useAuth();
  const { stores, settings } = useData();
  const multiStore = !!settings?.multiStore;
  const [currentStoreId, setCurrentStoreId] = useState(null);
  useEffect(() => {
    if (currentStoreId != null) return;
    const fallbackId = user?.storeId || stores?.[0]?.id || 1;
    setCurrentStoreId(fallbackId);
  }, [user, stores]); // eslint-disable-line
  return (
    <StoreContext.Provider value={{ stores: stores || [], currentStoreId: currentStoreId || user?.storeId || 1, setCurrentStoreId, multiStore }}>
      {children}
    </StoreContext.Provider>
  );
};

const AccessDenied = ({ feature }) => (
  <div className="flex-1 flex items-center justify-center p-8">
    <div className="max-w-md text-center bg-white border border-stone-200 rounded-2xl p-10 shadow-sm">
      <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
        <ShieldCheck size={26} />
      </div>
      <h2 className="text-xl font-semibold text-stone-900 mb-2">Access restricted</h2>
      <p className="text-sm text-stone-600">
        Your role does not have permission to view <span className="font-medium">{feature}</span>.
        Please contact an administrator if you believe this is a mistake.
      </p>
    </div>
  </div>
);

// Shifts (clock-in, the Shifts nav item itself) belong to the fixed POS
// terminal at the counter, not a handheld device — buddy-punching from a
// personal phone or tablet is much easier than from the till.
const isHandheldUA = (ua = '') => {
  if (/iPad/i.test(ua)) return true;
  if (/iPhone|iPod/i.test(ua)) return true;
  if (/Android/i.test(ua)) return true;
  if (/Windows Phone/i.test(ua)) return true;
  return false;
};

const ShiftProvider = ({ children }) => {
  const { shifts: liveShifts, patch, refresh, queueMutation } = useData();
  const { user } = useAuth();
  const { toast } = useToast();
  const shifts = liveShifts || [];

  const activeShifts = shifts.filter(s => !s.clockOut);
  // The open shift belonging to whoever is logged in (if any). Self-service
  // shifts are keyed by userId — separate from employeeId, which is only
  // ever a Staff register entry for a roster (non-login) employee.
  const myShift = user ? shifts.find(s => !s.clockOut && String(s.userId) === String(user.id)) : null;

  // Cashier on the clock for the POS: must be the LOGGED-IN user's own open
  // shift — never anyone else's. Checkout used to fall back to "any other
  // clocked-in cashier" so it could proceed under someone else's name; a
  // sale must always be attributed to whoever is actually checking out.
  const activeCashier = myShift ? { id: user.id, name: user.name, role: user.role } : null;

  // The very first load of shifts (and everything else) happens before
  // anyone's logged in, with no auth token yet — that's when /shifts can't
  // know to strip cash-reconciliation fields for a cashier. Re-pull once a
  // real session exists so that role-aware filtering actually applies.
  useEffect(() => { if (user) refresh(); }, [user?.id]); // eslint-disable-line

  // Clock the LOGGED-IN user in — never anyone else. photoDataUrl is a
  // snapshot taken right at this moment (see the camera modal in
  // ShiftsView) — it's uploaded the same way a product photo is, then the
  // resulting path is what actually gets attached to the new shift, so a
  // manager can later check that the person on camera matches the name on
  // the shift. Queued for offline retry like clock-out, since uploading a
  // photo (unlike the old fingerprint challenge) doesn't need a live
  // server round-trip to even start.
  const clockIn = async (photoDataUrl) => {
    if (!user) return;
    if (isHandheldUA(navigator.userAgent)) {
      toast('Clock in from the POS terminal — not a phone or tablet', 'error');
      return;
    }
    try {
      // Admin clocks in without a photo (photoDataUrl is null) — skip upload.
      let photoPath = null;
      if (photoDataUrl) {
        const { path } = await api.uploadImage('clockin.jpg', photoDataUrl);
        photoPath = path;
      }
      const sh = await api.clockIn(photoPath);
      patch('shifts', list => [sh, ...list]);
      toast('Clocked in', 'success');
    } catch (e) {
      if (!e.status) {
        queueMutation('clockIn', { photo: photoDataUrl });
        patch('shifts', list => [{ id: Date.now(), userId: user.id, name: user.name, role: user.role, clockIn: new Date().toISOString(), clockOut: null }, ...list]);
        toast('Offline — clock-in saved on this device, will sync automatically once back online', 'info');
      } else {
        toast(e.message, 'error');
      }
    }
  };
  // countedCash is the cash drawer amount counted at clock-out, for the
  // per-shift reconciliation the server computes (expected vs counted).
  const clockOut = async (countedCash) => {
    if (!user) return;
    try {
      await api.clockOut(countedCash);
      refresh();
    } catch (e) {
      if (!e.status) {
        queueMutation('clockOut', { countedCash });
        patch('shifts', list => list.map(s => String(s.userId) === String(user.id) && !s.clockOut ? { ...s, clockOut: new Date().toISOString() } : s));
        toast('Offline — clock-out saved on this device, will sync automatically once back online', 'info');
      } else {
        toast(e.message, 'error');
      }
    }
  };

  // Staff register: a manager/cashier/admin clocking a roster EMPLOYEE
  // (never themselves) in or out. No photo, no cash reconciliation —
  // see server/src/routes/api.js's register-in/register-out for why.
  const registerClockIn = async (employeeId) => {
    try {
      const sh = await api.registerClockIn(employeeId);
      patch('shifts', list => [sh, ...list]);
    } catch (e) {
      toast(!e.status ? "Can't reach the server — check your connection and try again" : e.message, 'error');
    }
  };
  const registerClockOut = async (employeeId) => {
    try {
      const sh = await api.registerClockOut(employeeId);
      patch('shifts', list => list.map(s => s.id === sh.id ? sh : s));
    } catch (e) {
      toast(!e.status ? "Can't reach the server — check your connection and try again" : e.message, 'error');
    }
  };

  return (
    <ShiftContext.Provider value={{ shifts, activeShifts, myShift, activeCashier, clockIn, clockOut, registerClockIn, registerClockOut }}>
      {children}
    </ShiftContext.Provider>
  );
};

// ============ DATA ============
const CATEGORIES = [
  { id: 'all', tKey: 'all_items', icon: LayoutGrid },
  { id: 'sets', tKey: 'sets', icon: SquareStack },
  { id: 'jerseys', tKey: 'jerseys', icon: Medal },
  { id: 'trousers', tKey: 'trousers', icon: Layers },
  { id: 'pullovers', tKey: 'pullovers', icon: Shirt },
  { id: 'shirts', tKey: 'shirts', icon: Shapes },
  { id: 'shorts', tKey: 'shorts', icon: Columns },
  { id: 'tshirts', tKey: 'tshirts', icon: Shirt },
  { id: 'others', tKey: 'others', icon: Package },
];

// Merges the 7 built-in categories (which have a translated label + a
// specific icon) with whatever's actually in the backend's categories
// table — covers the defaults plus anything custom added via "+ New" in
// the product form. A custom one has no translation key (it's already in
// whatever language someone typed it in) and gets a generic icon.
const useCategoryList = ({ includeAll = false } = {}) => {
  const { t } = useT();
  const { online, categories: liveCategories } = useData();
  const builtin = new Map(CATEGORIES.filter(c => c.id !== 'all').map(c => [c.id, c]));
  const fallbackDefaults = CATEGORIES.filter(c => c.id !== 'all').map(c => ({ id: c.id, label: t(c.tKey) }));
  const source = (online && liveCategories?.length) ? liveCategories : fallbackDefaults;
  const list = source.map(c => {
    const b = builtin.get(c.id);
    return { id: c.id, label: b ? t(b.tKey) : c.label, icon: b?.icon || Package };
  });
  return includeAll ? [{ id: 'all', label: t('all_items'), icon: LayoutGrid }, ...list] : list;
};

const PRODUCTS = [];

// A product is a "style"; what's actually sold/stocked is one of its
// variants (a size/color combo). Falls back to a single implicit "One Size"
// variant built from the product's own id/sku/stock for any product that
// somehow has none attached, so the rest of the app never has to branch on
// whether variants exist.
const variantsOf = (p) => (p?.variants?.length ? p.variants : [{ id: p?.id, productId: p?.id, size: 'One Size', color: null, sku: p?.sku, stock: p?.stock ?? 0, image: p?.image }]);

const PRODUCT_NAMES_FR = {};

const CUSTOMERS = [
  { id: 1, name: 'Aminata Bakary', phone: '+237 6 78 12 34 56', points: 1840, tier: 'Gold', visits: 47, spent: 425000 },
  { id: 2, name: 'Jean-Paul Mbarga', phone: '+237 6 99 22 11 33', points: 920, tier: 'Silver', visits: 28, spent: 198000 },
  { id: 3, name: 'Fatou Njoya', phone: '+237 6 55 67 89 01', points: 3210, tier: 'Platinum', visits: 89, spent: 782000 },
  { id: 4, name: 'Samuel Nkomo', phone: '+237 6 71 23 45 67', points: 340, tier: 'Bronze', visits: 12, spent: 67000 },
];

const SUPPLIERS = [
  { id: 1, name: 'Douala Textile Wholesale', contact: 'Pierre Etoga', phone: '+237 6 77 11 22 33', email: 'p.etoga@doualatextile.cm', productsCount: 0, lastOrder: '2026-05-20', status: 'active', category: 'Shirts & T-Shirts' },
  { id: 2, name: 'Wouri Sportswear Imports', contact: 'Sylvie Manga', phone: '+237 6 91 88 77 66', email: 'contact@wourisportswear.cm', productsCount: 0, lastOrder: '2026-05-24', status: 'active', category: 'Jerseys' },
  { id: 3, name: 'Bonapriso Tailoring House', contact: 'Robert Nguele', phone: '+237 6 55 44 33 22', email: 'robert@bonaprisotailoring.cm', productsCount: 0, lastOrder: '2026-05-25', status: 'active', category: 'Sets' },
  { id: 4, name: 'Kribi Leather Goods', contact: 'Claudette Atangana', phone: '+237 6 78 99 88 77', email: 'claudette@kribileather.cm', productsCount: 0, lastOrder: '2026-05-26', status: 'active', category: 'Others' },
  { id: 5, name: 'Deido Knitwear Co.', contact: 'Marc Tcheunkam', phone: '+237 6 22 11 00 99', email: 'marc@deidoknitwear.cm', productsCount: 0, lastOrder: '2026-05-18', status: 'active', category: 'Pullovers' },
  { id: 6, name: 'Akwa Denim Supply', contact: 'Aïcha Souley', phone: '+237 6 33 22 44 55', email: 'a.souley@akwadenim.cm', productsCount: 0, lastOrder: '2026-05-15', status: 'active', category: 'Trousers' },
  { id: 7, name: 'Bonanjo Fabric Traders', contact: 'Bruno Eyenga', phone: '+237 6 66 55 77 88', email: 'bruno@bonanjofabric.cm', productsCount: 0, lastOrder: '2026-04-28', status: 'inactive', category: 'Shorts' },
];

const PURCHASE_ORDERS = [];

const STOCK_MOVEMENTS = [];
const USERS_DATA = [
  { id: 1, name: "Joseph Eto'o", role: 'admin', email: 'joseph@riskycfashion.cm', lastActive: '2 min ago', store: 'All stores' },
  { id: 2, name: 'Mariam Ndongo', role: 'manager', email: 'mariam@riskycfashion.cm', lastActive: 'Just now', store: 'Central' },
  { id: 3, name: 'Paul Atangana', role: 'cashier', email: 'paul@riskycfashion.cm', lastActive: '12 min ago', store: 'Central' },
  { id: 4, name: 'Esther Ngo', role: 'cashier', email: 'esther@riskycfashion.cm', lastActive: '1 hour ago', store: 'Bastos' },
  { id: 5, name: 'David Onana', role: 'manager', email: 'david@riskycfashion.cm', lastActive: '3 hours ago', store: 'Akwa' },
];

// ============ HELPERS ============
export const fmt = (n) => new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA';
// Point redemption rate, confirmed with the business: 100 points = 500 FCFA.
// Mirrors the same constant in server/src/routes/api.js.
const FCFA_PER_POINT = 5;
// wa.me wants digits only, country code included, no leading +/0/spaces.
// Shared by the staff WhatsApp-notify feature and the customer promo one.
const normalizePhone = (raw) => (raw || '').replace(/[^\d]/g, '').replace(/^0+/, '');
// A "half packet" sale consumes roughly half a full packet's units — e.g. a
// carton of 6 sold as 3. Rounded since packet sizes aren't always even.
const halfPackUnits = (p) => Math.max(1, Math.round((p?.unitsPerPacket || 0) / 2));
const fmtShort = (n) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
  return n.toString();
};
// Turns a lastActive ISO timestamp into "Just now" / "5 min ago" / etc.
// Legacy demo accounts still carry a plain string (e.g. "2 min ago") instead
// of a timestamp — Date.parse returns NaN for those, so we just show it as-is.
const relativeLastActive = (iso) => {
  if (!iso) return 'Never';
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  if (ms < 60_000) return 'Just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} min ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)} hr ago`;
  return `${Math.floor(ms / 86_400_000)} d ago`;
};

const TIER_COLOR = {
  Platinum: 'bg-gradient-to-br from-stone-700 to-stone-900 text-white',
  Gold: 'bg-gradient-to-br from-amber-400 to-amber-600 text-white',
  Silver: 'bg-gradient-to-br from-stone-300 to-stone-500 text-white',
  Bronze: 'bg-gradient-to-br from-orange-300 to-orange-500 text-white',
};

const PO_STATUS = {
  draft: { color: 'bg-stone-100 text-stone-700', dot: 'bg-stone-400' },
  sent: { color: 'bg-sky-50 text-sky-700', dot: 'bg-sky-500' },
  'in-transit': { color: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  received: { color: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  cancelled: { color: 'bg-rose-50 text-rose-700', dot: 'bg-rose-500' },
};

// ============ UI BITS ============
// Each shop's own name, from their own settings — this component is
// shared code across every shop on the platform, so it must never
// hardcode one shop's brand. Falls back to a neutral label for the brief
// moment before settings finish loading (see DataProvider).
export const Logo = ({ size = 'md', subtitle = 'Point of Sale', hideTextClass = '' }) => {
  const { settings } = useData();
  const shopName = settings?.businessName || 'Point of Sale';
  const boxSize = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-16 h-16' : 'w-10 h-10';
  const dSize = size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-3xl' : 'text-lg';
  const nameSize = size === 'sm' ? '18px' : size === 'lg' ? '32px' : '20px';
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className={`${boxSize} rounded-xl bg-gradient-to-br from-rose-600 via-rose-700 to-rose-900 flex items-center justify-center shadow-lg shadow-rose-900/20 relative overflow-hidden flex-shrink-0`}>
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/20" />
        <span className={`text-white font-serif font-bold ${dSize} relative`} style={{ fontFamily: "'Fraunces', serif" }}>{shopName[0]?.toUpperCase()}</span>
      </div>
      <div className={`${hideTextClass} min-w-0`}>
        <div className="font-serif text-stone-900 leading-none whitespace-nowrap overflow-hidden text-ellipsis" style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: nameSize }}>
          {shopName.toUpperCase()}
        </div>
        <div className={`text-stone-500 tracking-[0.15em] uppercase mt-0.5 whitespace-nowrap ${size === 'lg' ? 'text-xs' : 'text-[10px]'}`}>{subtitle}</div>
      </div>
    </div>
  );
};

const LangToggle = () => {
  const { lang, setLang } = useT();
  return (
    <div className="flex items-center bg-white border border-stone-200 rounded-lg p-0.5 text-xs font-medium">
      <button onClick={() => setLang('en')}
        className={`px-2.5 py-1 rounded-md transition-all ${lang === 'en' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:text-stone-900'}`}>
        EN
      </button>
      <button onClick={() => setLang('fr')}
        className={`px-2.5 py-1 rounded-md transition-all ${lang === 'fr' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:text-stone-900'}`}>
        FR
      </button>
    </div>
  );
};

// There is no sidebar — this is now the only persistent nav surface. The
// Home button (only shown once you've left Home) is how every other screen
// gets back to the button hub; the account menu on the right replaces what
// used to live in the sidebar's footer (settings/help/switch account/sign out).
const TopBar = ({ title, subtitle, children, onHome, onSettings, showHome }) => {
  const { t, lang } = useT();
  const { products, online, pendingSyncCount, dismissPendingSync, settings } = useData();
  const { stores, currentStoreId, setCurrentStoreId, multiStore } = useStore();
  const { can } = useRole();
  const { user, logout: authLogout } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [storeMenuOpen, setStoreMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const lowStockThreshold = Number(settings?.lowStockThreshold) || 10;
  const lowStock = (products || []).filter(p => p.stock < lowStockThreshold);
  const logout = () => {
    if (window.confirm('Sign out of Riskyc Fashion?')) { authLogout(); toast('Signed out', 'info'); }
  };
  return (
    <div className="flex items-center justify-between px-4 sm:px-5 lg:px-7 py-4 bg-white/70 backdrop-blur border-b border-stone-200/80 flex-shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        {showHome && (
          <button onClick={onHome} title={t('home') || 'Home'}
            className="p-2 -ml-1 rounded-lg hover:bg-stone-100 text-stone-700 flex-shrink-0"><Home size={20} /></button>
        )}
        <div className="min-w-0">
          <h1 className="font-serif text-xl md:text-2xl text-stone-900 leading-tight truncate" style={{ fontFamily: "'Fraunces', serif", fontWeight: 500 }}>{title}</h1>
          {subtitle && <p className="text-xs text-stone-500 mt-0.5 truncate">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {children}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-stone-200 bg-white text-xs text-stone-600">
          <Calendar size={13} />
          <span>{new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
        </div>
        <LangToggle />
        <div className="relative">
          <button onClick={() => setOpen(o => !o)} className="relative p-2 rounded-lg hover:bg-stone-100">
            <Bell size={18} className="text-stone-600" />
            {lowStock.length > 0 && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-rose-500 rounded-full" />}
          </button>
          {open && (
            <div className="absolute right-0 mt-2 w-72 bg-white border border-stone-200 rounded-xl shadow-lg z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-stone-100 text-sm font-medium text-stone-900">Notifications</div>
              <div className="max-h-64 overflow-y-auto">
                {lowStock.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-stone-400">All good — no alerts</div>
                ) : lowStock.map(p => (
                  <div key={p.id} className="px-4 py-2.5 flex items-center gap-2 hover:bg-stone-50">
                    <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" />
                    <div className="text-xs">
                      <div className="font-medium text-stone-800">{p.name} low</div>
                      <div className="text-stone-500">{p.stock} left · {p.sku}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {pendingSyncCount > 0 && (
          <div className="flex items-center gap-1 pl-2 sm:pl-3 pr-1 py-1.5 rounded-lg bg-amber-50 text-amber-800 text-xs font-medium whitespace-nowrap" title="Saved on this device while offline — will sync automatically">
            <RefreshCw size={12} className="flex-shrink-0 animate-spin" style={{ animationDuration: '2s' }} />
            <span className="mx-1">{pendingSyncCount} pending sync</span>
            <button
              onClick={() => { if (window.confirm('Dismiss stuck sync items? Only do this if data was already saved or the item is outdated.')) dismissPendingSync(); }}
              className="p-1 rounded hover:bg-amber-100 text-amber-700 flex-shrink-0"
              title="Dismiss stuck items"
            >
              <X size={11} />
            </button>
          </div>
        )}
        {multiStore && stores.length > 0 && (
          <div className="relative hidden sm:block">
            <button onClick={() => setStoreMenuOpen(o => !o)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 bg-white text-xs text-stone-700 hover:bg-stone-50">
              <MapPin size={13} className="text-stone-400" />
              <span className="max-w-[120px] truncate">{stores.find(s => s.id === currentStoreId)?.name || 'Select store'}</span>
              <ChevronRight size={12} className="text-stone-400 rotate-90" />
            </button>
            {storeMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-stone-200 rounded-xl shadow-lg z-50 overflow-hidden">
                {stores.map(s => (
                  <button key={s.id} onClick={() => { setCurrentStoreId(s.id); setStoreMenuOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-stone-50 ${s.id === currentStoreId ? 'text-rose-700 font-medium' : 'text-stone-700'}`}>
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-medium whitespace-nowrap">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${online ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'}`} />
          {online ? 'Online' : 'Offline'}
        </div>

        {/* Account menu — replaces what used to live in the sidebar's footer:
            who's signed in, Settings, Help, Switch account, Sign out. */}
        <div className="relative">
          <button onClick={() => setAccountOpen(o => !o)}
            className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center text-white text-sm font-semibold shadow-sm flex-shrink-0">
            {(user?.name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </button>
          {accountOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setAccountOpen(false)} />
              <div className="absolute right-0 mt-2 w-60 bg-white border border-stone-200 rounded-xl shadow-lg z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-stone-100">
                  <div className="text-sm font-medium text-stone-900 truncate">{user?.name || 'User'}</div>
                  <div className="text-[11px] text-stone-500 truncate capitalize">{user?.role || ''}</div>
                </div>
                <div className="p-1.5">
                  {can.settings && (
                    <button onClick={() => { setAccountOpen(false); onSettings(); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-stone-600 hover:bg-stone-100">
                      <Settings size={15} className="flex-shrink-0" /> {t('settings')}
                    </button>
                  )}
                  <button onClick={() => { setAccountOpen(false); toast('Help: support@riskycfashion.cm · +237 6 77 00 00 00', 'info'); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-stone-600 hover:bg-stone-100">
                    <HelpCircle size={15} className="flex-shrink-0" /> {t('help')}
                  </button>
                  {can.admin && (
                    <button onClick={() => { setAccountOpen(false); if (window.confirm("Switch to a different business account on this device? This only affects this device — staff on other tills keep working normally. You'll need to sign back in here (shop, then your PIN) afterward.")) switchShop(); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-stone-600 hover:bg-stone-100">
                      <Building2 size={15} className="flex-shrink-0" /> Switch business account
                    </button>
                  )}
                  <button onClick={() => { setAccountOpen(false); logout(); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-rose-700 hover:bg-rose-50">
                    <LogOut size={15} className="flex-shrink-0" /> Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const KpiCard = ({ label, value, delta, icon: Icon, accent }) => (
  <div className="bg-white rounded-2xl p-5 border border-stone-200/80 hover:shadow-lg hover:shadow-stone-900/5 transition-all">
    <div className="flex items-start justify-between mb-3">
      <div className={`w-10 h-10 rounded-xl ${accent} flex items-center justify-center`}><Icon size={18} strokeWidth={1.8} /></div>
      {delta !== undefined && (
        <div className={`flex items-center gap-0.5 text-xs font-medium ${delta >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
          {delta >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(delta)}%
        </div>
      )}
    </div>
    <div className="text-[11px] uppercase tracking-widest text-stone-500 font-medium mb-1">{label}</div>
    <div className="font-serif text-2xl text-stone-900" style={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}>{value}</div>
  </div>
);

// ============ THERMAL RECEIPT (modal) ============
const QRPattern = () => {
  // Decorative QR-like pattern using SVG
  const cells = [];
  const size = 21;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Position markers (corner squares)
      const inCorner = (
        (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7)
      );
      let fill = false;
      if (inCorner) {
        const cx = x < 7 ? 3 : size - 4;
        const cy = y < 7 ? 3 : y >= size - 7 ? size - 4 : 3;
        const dx = Math.abs(x - cx), dy = Math.abs(y - cy);
        const m = Math.max(dx, dy);
        fill = m === 0 || m === 1 || m === 3;
      } else {
        // pseudo-random based on coords
        fill = ((x * 7 + y * 13 + x * y) % 5) < 2;
      }
      if (fill) cells.push({ x, y });
    }
  }
  return (
    <svg viewBox="0 0 21 21" className="w-24 h-24">
      {cells.map((c, i) => <rect key={i} x={c.x} y={c.y} width="1" height="1" fill="#0f172a" />)}
    </svg>
  );
};

const ReceiptModal = ({ open, onClose, data, onNewOrder }) => {
  const { t, lang } = useT();
  const { activeCashier } = useShifts();
  // Every field printed on this receipt must come from the logged-in
  // shop's own settings — this component is shared across every shop on
  // the platform, so it must never hardcode one shop's name/address/tax
  // numbers (a receipt showing the WRONG shop's RCCM/NIU is a real
  // compliance problem, not just cosmetic).
  const { settings } = useData();
  const shopName = settings?.businessName || 'Point of Sale';
  // Inject a scoped @page rule so the receipt prints on 80 mm thermal paper.
  // Done here rather than in index.css so it doesn't affect the Reports
  // page, which also calls window.print() but needs a full-size page.
  useEffect(() => {
    if (!open) return;
    const style = document.createElement('style');
    style.id = 'receipt-page-size';
    style.textContent = '@page { size: 80mm auto; margin: 0; }';
    document.head.appendChild(style);
    return () => document.getElementById('receipt-page-size')?.remove();
  }, [open]);

  // Fires once per completed sale, right as the receipt appears — printing
  // shouldn't depend on someone remembering to click Print every time.
  // The brief delay lets the modal actually paint first.
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => window.print(), 250);
    return () => clearTimeout(id);
  }, [open]);
  if (!open) return null;
  const { items = [], subtotal = 0, discount = 0, pointsDiscountAmt = 0, creditUsed = 0, total = 0, customer, method = 'cash', invoiceNo = '' } = data || {};
  const paid = total;
  const change = 0;
  const productName = (p) => lang === 'fr' ? (PRODUCT_NAMES_FR[p.id] || p.name) : p.name;

  return (
    <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-stone-100 rounded-2xl max-w-md w-full flex flex-col" style={{ maxHeight: '92vh' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-200">
          <div className="flex items-center gap-2">
            <Receipt size={16} className="text-stone-600" />
            <span className="font-medium text-stone-900 text-sm">{t('receipt')}</span>
            <span className="text-[10px] uppercase tracking-widest text-stone-500 ml-1">· {t('original')}</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-stone-200">
            <X size={15} className="text-stone-600" />
          </button>
        </div>

        {/* Receipt paper */}
        <div className="overflow-y-auto p-5 flex-1">
          <div className="print-receipt bg-white shadow-md mx-auto" style={{ width: '300px', fontFamily: "'JetBrains Mono', 'Courier New', monospace", fontSize: '11px', color: '#0c0a09' }}>
            {/* Top tear edge */}
            <div className="h-2 bg-white" style={{ background: 'linear-gradient(135deg, white 25%, transparent 25%) -5px 0, linear-gradient(225deg, white 25%, transparent 25%) -5px 0, white', backgroundSize: '10px 10px', backgroundRepeat: 'repeat-x' }} />

            <div className="px-5 pb-5 pt-2">
              {/* Logo */}
              {settings?.showLogo !== false && (
                <div className="flex justify-center mb-2">
                  <div className="w-10 h-10 rounded-lg bg-stone-900 flex items-center justify-center">
                    <span className="text-white font-bold text-base" style={{ fontFamily: "'Fraunces', serif" }}>{shopName[0]?.toUpperCase()}</span>
                  </div>
                </div>
              )}
              <div className="text-center mb-1">
                <div className="font-bold text-base tracking-wide" style={{ fontFamily: "'Fraunces', serif" }}>{shopName.toUpperCase()}</div>
              </div>
              {(settings?.address || settings?.phone) && (
                <div className="text-center text-[10px] leading-snug text-stone-700 mb-2">
                  {settings?.address && <>{settings.address}<br /></>}
                  {settings?.phone}
                </div>
              )}
              {settings?.taxIdPrint && (settings?.rccm || settings?.niu) && (
                <div className="text-center text-[9px] text-stone-500 mb-3">
                  {[settings.rccm && `RCCM: ${settings.rccm}`, settings.niu && `NIU: ${settings.niu}`].filter(Boolean).join(' · ')}
                </div>
              )}

              <div className="border-t border-dashed border-stone-300 my-2" />

              {/* Invoice meta */}
              <div className="grid grid-cols-2 gap-y-0.5 text-[10px] my-2">
                <div className="text-stone-500">{t('invoice')}:</div>
                <div className="text-right font-medium">{invoiceNo || 'INV-2026-' + Math.floor(Math.random() * 9000 + 1000)}</div>
                <div className="text-stone-500">{t('order_date')}:</div>
                <div className="text-right">{new Date().toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                <div className="text-stone-500">{t('cashier_label')}:</div>
                <div className="text-right">{activeCashier ? activeCashier.name : '—'}</div>
                <div className="text-stone-500">{t('station_label')}:</div>
                <div className="text-right">POS-03</div>
                <div className="text-stone-500">{t('customer')}:</div>
                <div className="text-right">{customer?.name || t('walk_in_customer')}</div>
              </div>

              <div className="border-t border-dashed border-stone-300 my-2" />

              {/* Items header */}
              <div className="flex justify-between text-[10px] uppercase tracking-wider text-stone-500 font-bold mb-1">
                <span>{t('items_label')}</span><span>{t('total')}</span>
              </div>

              {items.length === 0 ? (
                <div className="text-center text-stone-400 text-[10px] py-2">— no items —</div>
              ) : items.map(it => (
                <div key={`${it.id}-${it.mode || 'unit'}`} className="mb-1">
                  <div className="flex justify-between gap-2">
                    <span className="flex-1">
                      {productName(it)}{it.mode === 'packet' ? ` (pack ×${it.unitsPerPacket})` : it.mode === 'half' ? ` (half pack ×${halfPackUnits(it)})` : ''}
                      {((it.size && it.size !== 'One Size') || it.color) ? ` — ${[it.size, it.color].filter(Boolean).join(' / ')}` : ''}
                    </span>
                    <span className="font-medium">{fmt(it.price * it.qty)}</span>
                  </div>
                  <div className="flex justify-between text-stone-500 text-[10px] pl-1">
                    <span>{it.qty} × {fmt(it.price)}</span>
                    <span className="font-mono">{it.sku}</span>
                  </div>
                </div>
              ))}

              <div className="border-t border-dashed border-stone-300 my-2" />

              {/* Totals */}
              <div className="space-y-0.5 text-[11px]">
                <div className="flex justify-between"><span>{t('subtotal')}</span><span>{fmt(subtotal)}</span></div>
                {discount > 0 && (
                  <div className="flex justify-between text-rose-700 font-medium"><span>Discount</span><span>-{fmt(discount)}</span></div>
                )}
                {pointsDiscountAmt > 0 && (
                  <div className="flex justify-between text-violet-700 font-medium"><span>Points redeemed</span><span>-{fmt(pointsDiscountAmt)}</span></div>
                )}
                {creditUsed > 0 && (
                  <div className="flex justify-between text-teal-700 font-medium"><span>Store credit</span><span>-{fmt(creditUsed)}</span></div>
                )}
                <div className="border-t border-stone-900 my-1.5" />
                <div className="flex justify-between font-bold text-sm">
                  <span>{t('total')}</span>
                  <span style={{ fontFamily: "'Fraunces', serif" }}>{fmt(total)}</span>
                </div>
              </div>

              <div className="border-t border-dashed border-stone-300 my-2" />

              {/* Payment */}
              <div className="space-y-0.5 text-[11px]">
                <div className="flex justify-between"><span>{t('method')}:</span><span className="font-medium capitalize">{t(method)}</span></div>
                <div className="flex justify-between"><span>{t('paid')}:</span><span>{fmt(paid)}</span></div>
                <div className="flex justify-between"><span>{t('change')}:</span><span>{fmt(change)}</span></div>
              </div>


              {settings?.showQR && (
                <>
                  <div className="border-t border-dashed border-stone-300 my-3" />
                  {/* QR */}
                  <div className="flex flex-col items-center gap-1 my-3">
                    <QRPattern />
                    <div className="text-[9px] text-stone-500 uppercase tracking-widest">DGI · e-invoice verified</div>
                  </div>
                </>
              )}

              <div className="border-t border-dashed border-stone-300 my-2" />

              <div className="text-center text-[10px] text-stone-600 leading-snug my-2">
                <div className="font-bold mb-0.5" style={{ fontFamily: "'Fraunces', serif" }}>{settings?.receiptHeader || t('thank_you')}</div>
                <div>{settings?.receiptFooter || t('visit_again')}</div>
                {settings?.website && <div className="mt-2 text-stone-400">{settings.website}</div>}
              </div>

              {/* Bottom tear edge */}
            </div>
            <div className="h-2 bg-white" style={{ background: 'linear-gradient(45deg, white 25%, transparent 25%) -5px 0, linear-gradient(-45deg, white 25%, transparent 25%) -5px 0, white', backgroundSize: '10px 10px', backgroundRepeat: 'repeat-x' }} />
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-stone-200 p-4 grid grid-cols-2 gap-2 flex-shrink-0">
          <button onClick={() => window.print()} className="flex items-center justify-center gap-1.5 py-2 border border-stone-200 bg-white rounded-lg text-xs font-medium hover:bg-stone-50">
            <Printer size={14} /> {t('print')}
          </button>
          <button onClick={() => { onNewOrder ? onNewOrder() : onClose(); }} className="py-2 bg-rose-900 text-white rounded-lg text-xs font-medium hover:bg-rose-800">
            {onNewOrder ? t('new_order') : t('close')}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============ POS VIEW ============
// Barcode scan box. A USB/Bluetooth scanner acts as a keyboard: it types the
// code into the focused field and presses Enter. This modal keeps an input
// focused so the cashier can scan items one after another; manual typing works too.
const ScanModal = ({
  open, onClose, onScan,
  title = 'Scan barcode',
  description = "Point your barcode scanner and scan an item — it adds to the cart automatically. You can also type a product's SKU/barcode and press Enter.",
  tip = 'Tip: most USB barcode scanners work instantly — no setup needed. Keep this box open to scan several items in a row.',
}) => {
  const inputRef = useRef(null);
  const [code, setCode] = useState('');
  const { products: liveProducts, online } = useData();
  const products = online ? (liveProducts || []) : (liveProducts?.length ? liveProducts : PRODUCTS);
  useEffect(() => {
    if (open) { setCode(''); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [open]);
  const submit = (value = code) => { if (onScan(value)) setCode(''); else setCode(''); inputRef.current?.focus(); };
  // A hardware scanner types the whole code in one burst and hits Enter
  // before this ever has a chance to render — these suggestions are really
  // only seen by someone typing by hand, to save them finishing a SKU they
  // can already recognize or to catch one that already exists.
  const q = code.trim().toLowerCase();
  const suggestions = q.length >= 2
    ? products.filter(p => (p.sku || '').toLowerCase().includes(q) || (p.name || '').toLowerCase().includes(q)).slice(0, 6)
    : [];
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-stone-600 mb-3">{description}</p>
      <div className="flex items-center gap-2">
        <Scan size={18} className="text-rose-700 flex-shrink-0" />
        <input
          ref={inputRef}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder="Scan or type code, then Enter"
          className="flex-1 px-3 py-2.5 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-100" />
      </div>
      {suggestions.length > 0 && (
        <div className="mt-2 border border-stone-200 rounded-lg overflow-hidden divide-y divide-stone-100 max-h-56 overflow-y-auto">
          {suggestions.map((p) => (
            <button key={p.id} type="button" onClick={() => submit(p.sku)}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-stone-50 text-left">
              <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-base flex-shrink-0 overflow-hidden">
                {p.image ? <img src={imageUrl(p.image)} alt="" className="w-full h-full object-cover" /> : (p.emoji || '📦')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-stone-900 truncate">{p.name}</div>
                <div className="text-xs text-stone-400 font-mono">{p.sku}</div>
              </div>
              <div className="text-sm text-rose-900 flex-shrink-0">{fmt(p.price)}</div>
            </button>
          ))}
        </div>
      )}
      {tip && <p className="text-xs text-stone-400 mt-3">{tip}</p>}
    </Modal>
  );
};

// ============ HOME ============
// The first thing anyone sees after logging in — now the app's only nav
// hub, since there is no sidebar. Each button is a section a Sidebar item
// used to link to; permissions/handheld filtering mirror what Sidebar used
// to do. TopBar's Home button is how you get back here from any section.
const NAV_STYLE = {
  pos:        { gradient: 'from-rose-500 to-rose-800',   icon: ShoppingCart },
  dashboard:  { gradient: 'from-violet-500 to-purple-700', icon: BarChart3 },
  inventory:  { gradient: 'from-emerald-500 to-teal-700', icon: Package },
  customers:  { gradient: 'from-sky-400 to-blue-600',     icon: Users },
  reports:    { gradient: 'from-amber-400 to-orange-600', icon: FileText },
  expenses:   { gradient: 'from-orange-400 to-red-600',   icon: Receipt },
  manualSale: { gradient: 'from-teal-400 to-cyan-700',    icon: ClipboardList },
  shifts:     { gradient: 'from-slate-500 to-slate-700',  icon: Clock },
  settings:   { gradient: 'from-stone-600 to-stone-800',  icon: Settings },
};

const HomeView = ({ onNavigate }) => {
  const { t } = useT();
  const { user } = useAuth();
  const { can } = useRole();

  // Same section list (and same permission/handheld filtering) Sidebar used
  // to apply — this is now the only place that list is offered.
  const onHandheld = isHandheldUA(navigator.userAgent);
  const sections = [
    { id: 'pos', label: t('checkout') },
    { id: 'dashboard', label: t('dashboard') },
    { id: 'inventory', label: t('inventory') },
    { id: 'customers', label: t('customers') },
    { id: 'reports', label: t('reports') },
    { id: 'expenses', label: t('expenses') || 'Expenses' },
    { id: 'manualSale', label: t('manualSale') || 'Record Sale' },
    { id: 'shifts', label: t('shifts') || 'Shifts' },
    { id: 'settings', label: t('settings') },
  ].filter(item => can[item.id] && (item.id !== 'shifts' || !onHandheld));

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t('good_morning');
    if (h < 18) return t('good_afternoon');
    return t('good_evening');
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-br from-stone-50 via-white to-rose-50/30 p-6 sm:p-10">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <div className="text-sm text-stone-500">{greeting()},</div>
          <h1 className="text-3xl sm:text-4xl text-stone-900 leading-tight" style={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}>
            {(user?.name || '').split(' ')[0] || t('welcome_back')}
          </h1>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {sections.map(item => {
            const style = NAV_STYLE[item.id] || { gradient: 'from-stone-400 to-stone-600', icon: Package };
            const Icon = style.icon;
            return (
              <button key={item.id} onClick={() => onNavigate(item.id)}
                className={`relative aspect-square rounded-3xl bg-gradient-to-br ${style.gradient} text-white overflow-hidden shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all p-5 flex flex-col items-center justify-center text-center gap-2`}>
                <Icon size={30} className="relative z-10 drop-shadow" />
                <div className="relative z-10 font-semibold text-xl leading-tight drop-shadow text-center">{item.label}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ============ DISCOUNT INPUT MODAL ============
// Cashier enters the discount amount freely — no PIN required.
// The order only completes once a manager approves the request server-side.
const DiscountInputModal = ({ open, onClose, onApply, subtotal }) => {
  const [mode, setMode] = useState('pct');   // 'pct' | 'fcfa'
  const [entry, setEntry] = useState('');
  const { toast } = useToast();

  useEffect(() => { if (!open) { setEntry(''); setMode('pct'); } }, [open]);

  const press = (k) => {
    if (k === 'C') { setEntry(''); return; }
    if (k === '←') { setEntry(e => e.slice(0, -1)); return; }
    if (entry.length >= 8) return;
    setEntry(e => e + k);
  };

  const apply = () => {
    const num = parseFloat(entry) || 0;
    if (num <= 0) { toast('Enter a discount amount', 'error'); return; }
    if (mode === 'pct') {
      if (num > 100) { toast('Cannot exceed 100%', 'error'); return; }
      onApply(Math.round(subtotal * num / 100));
    } else {
      if (num > subtotal) { toast('Discount cannot exceed subtotal', 'error'); return; }
      onApply(Math.round(num));
    }
    onClose();
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-80 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-stone-900 px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-white font-medium text-sm">Enter Discount</div>
            <div className="text-stone-400 text-[11px] mt-0.5">Subtotal: {fmt(subtotal)}</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-800"><X size={16} className="text-stone-400" /></button>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-1 bg-stone-100 rounded-xl p-1 mb-4">
            {[{id:'pct',label:'% Percentage'},{id:'fcfa',label:'FCFA Amount'}].map(m => (
              <button key={m.id} onClick={() => { setMode(m.id); setEntry(''); }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${mode === m.id ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500'}`}>
                {m.label}
              </button>
            ))}
          </div>
          <div className="bg-stone-50 rounded-xl px-4 py-3 mb-4 text-center min-h-[60px] flex flex-col items-center justify-center">
            <div className="text-2xl font-bold text-stone-900" style={{ fontFamily: "'Fraunces', serif" }}>
              {entry || '0'}{mode === 'pct' ? '%' : ' FCFA'}
            </div>
            {entry && mode === 'pct' && (
              <div className="text-xs text-stone-500 mt-0.5">= {fmt(Math.round(subtotal * (parseFloat(entry)||0) / 100))}</div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {['1','2','3','4','5','6','7','8','9','C','0','←'].map((k, i) => (
              <button key={i} onClick={() => press(k)}
                className={`h-12 rounded-xl text-base font-medium transition-all active:scale-95 ${
                  k === 'C' ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' :
                  k === '←' ? 'bg-stone-100 text-stone-500 hover:bg-stone-200' :
                  'bg-stone-100 text-stone-900 hover:bg-stone-200'
                }`}>
                {k}
              </button>
            ))}
          </div>
          <button onClick={apply}
            className="w-full py-3 bg-gradient-to-r from-rose-700 to-rose-900 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-rose-900/20 transition-all flex items-center justify-center gap-2">
            <Percent size={15} /> Apply Discount
          </button>
        </div>
      </div>
    </div>
  );
};

// ============ DISCOUNT APPROVAL WATCHER ============
// Runs globally for admin/manager — polls for pending discount requests and
// shows an approval modal so they can approve or reject without switching tabs.
const DiscountApprovalWatcher = () => {
  const { user } = useAuth();
  const { online } = useData();
  const { toast } = useToast();
  const [pending, setPending] = useState([]);
  const [current, setCurrent] = useState(null);
  const isManager = user && ['admin', 'manager'].includes(user.role);

  useEffect(() => {
    if (!isManager || !online) return;
    const poll = async () => {
      try {
        const list = await api.getPendingDiscountRequests();
        setPending(list);
        setCurrent(prev => {
          if (prev && list.find(r => r.id === prev.id)) return prev; // keep current if still pending
          return list[0] || null;
        });
      } catch {}
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [isManager, online]); // eslint-disable-line

  const approve = async () => {
    if (!current) return;
    try {
      await api.approveDiscountRequest(current.id);
      toast(`Discount approved for ${current.cashier}`);
      const next = pending.filter(r => r.id !== current.id);
      setPending(next);
      setCurrent(next[0] || null);
    } catch (e) { toast(e.message, 'error'); }
  };

  const reject = async () => {
    if (!current) return;
    const note = window.prompt('Reason for rejection (optional):') ?? '';
    // user pressed Cancel on prompt → note is null; treat as cancel-reject
    if (note === null) return;
    try {
      await api.rejectDiscountRequest(current.id, note);
      toast('Discount rejected');
      const next = pending.filter(r => r.id !== current.id);
      setPending(next);
      setCurrent(next[0] || null);
    } catch (e) { toast(e.message, 'error'); }
  };

  if (!current || !isManager) return null;
  const newTotal = current.subtotal - current.discountAmt;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-96 overflow-hidden">
        <div className="bg-amber-500 px-5 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/25 flex items-center justify-center flex-shrink-0">
            <Percent size={18} className="text-white" />
          </div>
          <div>
            <div className="text-white font-semibold">Discount Approval Required</div>
            <div className="text-amber-100 text-[11px] mt-0.5">Requested by {current.cashier}</div>
          </div>
        </div>
        <div className="p-5">
          <div className="bg-stone-50 rounded-xl p-3 mb-4 max-h-40 overflow-y-auto space-y-1">
            {current.items.map((it, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-stone-700 truncate flex-1 mr-2">{it.name} × {it.qty}</span>
                <span className="text-stone-500 flex-shrink-0">{fmt(it.price * it.qty)}</span>
              </div>
            ))}
          </div>
          <div className="space-y-1.5 text-sm mb-5">
            <div className="flex justify-between text-stone-500"><span>Subtotal</span><span>{fmt(current.subtotal)}</span></div>
            <div className="flex justify-between font-semibold text-rose-600 text-base">
              <span>Discount requested</span><span>-{fmt(current.discountAmt)}</span>
            </div>
            <div className="h-px bg-stone-200 my-1" />
            <div className="flex justify-between font-bold text-stone-900 text-base">
              <span>New total</span>
              <span style={{ fontFamily: "'Fraunces', serif" }}>{fmt(newTotal)}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={reject}
              className="flex-1 py-3 border-2 border-rose-200 text-rose-600 rounded-xl font-medium hover:bg-rose-50 transition-all">
              Reject
            </button>
            <button onClick={approve}
              className="flex-1 py-3 bg-gradient-to-r from-emerald-700 to-emerald-900 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-emerald-900/20 transition-all">
              Approve
            </button>
          </div>
          {pending.length > 1 && (
            <div className="text-center text-xs text-stone-400 mt-3">{pending.length - 1} more request{pending.length - 1 > 1 ? 's' : ''} waiting</div>
          )}
        </div>
      </div>
    </div>
  );
};

// A product with more than one size/color shows this before it can be added
// to the cart — picking a variant is what tells the register (and the
// backend) exactly which stock bucket to sell from.
const VariantPickerModal = ({ product, onClose, onPick }) => {
  const { lang } = useT();
  if (!product) return null;
  const name = lang === 'fr' ? (product.name_fr || product.name) : product.name;
  return (
    <Modal open={!!product} onClose={onClose} title={name}>
      <div className="text-xs text-stone-500 mb-3">Choose a size/color</div>
      <div className="grid grid-cols-2 gap-2">
        {variantsOf(product).map(v => {
          const label = [v.size, v.color].filter(Boolean).join(' / ') || 'One Size';
          const out = v.stock <= 0;
          return (
            <button key={v.id} type="button" disabled={out} onClick={() => onPick(v)}
              className={`px-3 py-2.5 rounded-lg border text-sm font-medium text-left transition-all ${out ? 'opacity-40 cursor-not-allowed border-stone-200' : 'border-stone-200 hover:border-rose-600 hover:bg-rose-50 cursor-pointer'}`}>
              <div>{label}</div>
              <div className="text-[11px] text-stone-400">{out ? 'Out of stock' : `${v.stock} in stock`}</div>
            </button>
          );
        })}
      </div>
    </Modal>
  );
};

// ============ RETURNS / EXCHANGES ============
// A cashier submits which line(s) of a past sale are coming back; a
// manager/admin approves before the customer is credited. Unlike the
// discount-approval flow, nothing here waits on the submitting browser —
// approval itself performs the stock-restock and credit-grant server-side
// (see ReturnApprovalWatcher below), so this modal can just fire the
// request and close.
const ReturnRequestModal = ({ open, onClose }) => {
  const { toast } = useToast();
  const [step, setStep] = useState(1); // 1 = find order, 2 = pick items
  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState(null);
  const [order, setOrder] = useState(null);
  const [selected, setSelected] = useState({}); // orderItemId -> qty
  const [reason, setReason] = useState('Wrong size/fit');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(1); setSearch(''); setOrders(null); setOrder(null); setSelected({}); setReason('Wrong size/fit'); setNote('');
    api.getOrders().then(setOrders).catch(() => setOrders([]));
  }, [open]);

  const matches = (orders || []).filter(o =>
    search.length > 0 && (o.invoiceNo || '').toLowerCase().includes(search.toLowerCase())
  ).slice(0, 8);

  const pickOrder = async (o) => {
    try {
      const full = await api.getOrder(o.id);
      setOrder(full);
      setStep(2);
    } catch (e) { toast(e.message || 'Could not load that sale', 'error'); }
  };

  const setQty = (itemId, maxQty, val) => {
    const q = Math.max(0, Math.min(maxQty, parseInt(val) || 0));
    setSelected(s => ({ ...s, [itemId]: q }));
  };

  const creditAmt = order ? order.items.reduce((sum, it) => sum + (selected[it.id] || 0) * it.price, 0) : 0;

  const submit = async () => {
    const items = Object.entries(selected).filter(([, qty]) => qty > 0).map(([orderItemId, qty]) => ({ orderItemId: Number(orderItemId), qty }));
    if (items.length === 0) { toast('Select at least one item to return', 'error'); return; }
    setSubmitting(true);
    try {
      await api.createReturnRequest({ orderId: order.id, items, reason, note });
      toast('Return request submitted — awaiting manager approval');
      onClose();
    } catch (e) {
      toast(!e.status ? "Can't submit a return while offline" : e.message, 'error');
    }
    setSubmitting(false);
  };

  return (
    <Modal open={open} onClose={onClose} title={step === 1 ? 'Find the original sale' : `Return items · ${order?.invoiceNo}`}
      footer={step === 1 ? null : (
        <>
          <GhostBtn onClick={() => setStep(1)}>Back</GhostBtn>
          <PrimaryBtn onClick={submit} disabled={submitting || creditAmt <= 0}>{submitting ? 'Submitting…' : `Submit return (${fmt(creditAmt)} credit)`}</PrimaryBtn>
        </>
      )}>
      {step === 1 ? (
        <div>
          <Input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by invoice number…" />
          {orders === null ? (
            <div className="text-center text-sm text-stone-400 py-6">Loading recent sales…</div>
          ) : search.length === 0 ? (
            <div className="text-center text-xs text-stone-400 py-6">Type an invoice number to find the sale.</div>
          ) : matches.length === 0 ? (
            <div className="text-center text-xs text-stone-400 py-6">No matching sale in the last 200.</div>
          ) : (
            <div className="mt-2 border border-stone-200 rounded-lg divide-y divide-stone-100 max-h-60 overflow-y-auto">
              {matches.map(o => (
                <button key={o.id} onClick={() => pickOrder(o)} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-stone-50 text-left">
                  <div>
                    <div className="text-sm font-mono text-stone-900">{o.invoiceNo}</div>
                    <div className="text-xs text-stone-500">{new Date(o.createdAt).toLocaleString()}</div>
                  </div>
                  <span className="text-sm font-medium text-stone-700">{fmt(o.total)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="text-xs text-stone-500 mb-3">Choose how many of each item are coming back.</div>
          <div className="space-y-1.5 mb-4">
            {order.items.map(it => (
              <div key={it.id} className="flex items-center gap-2 bg-stone-50 rounded-lg px-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-stone-900 truncate">{it.name}</div>
                  <div className="text-xs text-stone-400">
                    {[it.size, it.color].filter(Boolean).join(' / ')} · sold {it.qty} × {fmt(it.price)}
                  </div>
                </div>
                <input type="number" min="0" max={it.qty} value={selected[it.id] || 0}
                  onChange={e => setQty(it.id, it.qty, e.target.value)}
                  className="w-16 px-1.5 py-1 text-sm border border-stone-200 rounded text-center focus:outline-none focus:border-rose-500 bg-white" />
              </div>
            ))}
          </div>
          <Field label="Reason">
            <select value={reason} onChange={e => setReason(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-rose-600">
              {['Wrong size/fit', 'Defective/damaged', 'Changed mind', 'Wrong item', 'Other'].map(r => <option key={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Note (optional)">
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
              className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-rose-600" />
          </Field>
          <div className="text-sm text-stone-700 mt-2">Store credit to grant: <span className="font-semibold">{fmt(creditAmt)}</span></div>
        </div>
      )}
    </Modal>
  );
};

// Runs globally for admin/manager — polls for pending return requests and
// shows an approval modal, mirroring DiscountApprovalWatcher. Unlike that
// flow, approving here doesn't need to "wake up" any cashier's browser: the
// backend performs the restock + credit grant itself (see PUT
// /return-requests/:id/approve).
const ReturnApprovalWatcher = () => {
  const { user } = useAuth();
  const { online } = useData();
  const { toast } = useToast();
  const [pending, setPending] = useState([]);
  const [current, setCurrent] = useState(null);
  const isManager = user && ['admin', 'manager'].includes(user.role);

  useEffect(() => {
    if (!isManager || !online) return;
    const poll = async () => {
      try {
        const list = await api.getPendingReturnRequests();
        setPending(list);
        setCurrent(prev => {
          if (prev && list.find(r => r.id === prev.id)) return prev;
          return list[0] || null;
        });
      } catch {}
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [isManager, online]); // eslint-disable-line

  const approve = async () => {
    if (!current) return;
    try {
      await api.approveReturnRequest(current.id);
      toast(`Return approved — ${fmt(current.creditAmt)} credited`);
      const next = pending.filter(r => r.id !== current.id);
      setPending(next);
      setCurrent(next[0] || null);
    } catch (e) { toast(e.message, 'error'); }
  };

  const reject = async () => {
    if (!current) return;
    const note = window.prompt('Reason for rejection (optional):') ?? '';
    if (note === null) return;
    try {
      await api.rejectReturnRequest(current.id, note);
      toast('Return rejected');
      const next = pending.filter(r => r.id !== current.id);
      setPending(next);
      setCurrent(next[0] || null);
    } catch (e) { toast(e.message, 'error'); }
  };

  if (!current || !isManager) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-96 overflow-hidden">
        <div className="bg-teal-600 px-5 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/25 flex items-center justify-center flex-shrink-0">
            <RefreshCw size={18} className="text-white" />
          </div>
          <div>
            <div className="text-white font-semibold">Return Approval Required</div>
            <div className="text-teal-100 text-[11px] mt-0.5">Requested by {current.requestedBy}</div>
          </div>
        </div>
        <div className="p-5">
          <div className="bg-stone-50 rounded-xl p-3 mb-4 max-h-40 overflow-y-auto space-y-1">
            {current.items.map((it, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-stone-700 truncate flex-1 mr-2">{it.name} × {it.qty}</span>
                <span className="text-stone-500 flex-shrink-0">{fmt(it.price * it.qty)}</span>
              </div>
            ))}
          </div>
          <div className="space-y-1.5 text-sm mb-5">
            <div className="flex justify-between text-stone-500"><span>Reason</span><span>{current.reason || '—'}</span></div>
            <div className="h-px bg-stone-200 my-1" />
            <div className="flex justify-between font-bold text-stone-900 text-base">
              <span>Store credit to grant</span>
              <span style={{ fontFamily: "'Fraunces', serif" }}>{fmt(current.creditAmt)}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={reject} className="flex-1 py-3 border-2 border-rose-200 text-rose-600 rounded-xl font-medium hover:bg-rose-50 transition-all">Reject</button>
            <button onClick={approve} className="flex-1 py-3 bg-gradient-to-r from-emerald-700 to-emerald-900 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-emerald-900/20 transition-all">Approve</button>
          </div>
          {pending.length > 1 && (
            <div className="text-center text-xs text-stone-400 mt-3">{pending.length - 1} more request{pending.length - 1 > 1 ? 's' : ''} waiting</div>
          )}
        </div>
      </div>
    </div>
  );
};

const POSView = ({ initialCategory, onCategoryConsumed }) => {
  const { t, lang } = useT();
  const { user } = useAuth();
  const { currentStoreId } = useStore();
  const { activeCashier } = useShifts();
  const { products: liveProducts, customers: liveCustomers, online, refresh, settings, queueMutation } = useData();
  const lowStockThreshold = Number(settings?.lowStockThreshold) || 10;
  const { toast } = useToast();
  const products = online ? (liveProducts || []) : (liveProducts?.length ? liveProducts : PRODUCTS);
  const customerList = online ? (liveCustomers || []) : (liveCustomers?.length ? liveCustomers : CUSTOMERS);
  const categoryPills = useCategoryList({ includeAll: true });
  const [activeCat, setActiveCat] = useState(initialCategory || 'all');
  // Consume the Home page's category pick exactly once — otherwise it'd
  // silently re-apply and override the cashier's own filter choice if this
  // component re-rendered for any other reason.
  useEffect(() => { if (initialCategory) onCategoryConsumed?.(); }, []); // eslint-disable-line
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [customer, setCustomer] = useState(null);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('mobile');
  const [showReceipt, setShowReceipt] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [discount, setDiscount] = useState(0);         // FCFA flat discount on this order
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountRequestId, setDiscountRequestId] = useState(null); // pending approval ID
  const pendingOrderRef = useRef(null); // { payload, snapshot } while waiting for approval
  const [variantPicker, setVariantPicker] = useState(null); // product awaiting a size/color pick
  // Points/credit redemption — separate from `discount` above so spending a
  // customer's own already-earned balance never routes through manager
  // approval the way a cashier-granted discount does.
  const [pointsRedeemed, setPointsRedeemed] = useState(0);
  const [creditApplied, setCreditApplied] = useState(0);
  const [showReturnModal, setShowReturnModal] = useState(false);

  // No customer is selected by default — this is a quick store counter, not
  // a loyalty-program checkout, and there's no time to register someone for
  // every sale. Checkout works fine with nobody attached; "Walk-In Customer"
  // is just a display label for that, not a real customer record.

  const productName = (p) => lang === 'fr' ? (p.name_fr || PRODUCT_NAMES_FR[p.id] || p.name) : p.name;

  const filtered = useMemo(() => products.filter(p =>
    (activeCat === 'all' || p.category === activeCat) &&
    (productName(p).toLowerCase().includes(search.toLowerCase()) || (p.sku || '').toLowerCase().includes(search.toLowerCase()))
  ), [activeCat, search, lang, products]);

  // Stock is always tracked in individual units. A cart line added "by
  // packet" (mode === 'packet') consumes unitsPerPacket units per qty, and
  // "by half packet" (mode === 'half') consumes half that (rounded), so a
  // product can have a unit-mode, half-mode, and packet-mode line in the
  // cart at once (e.g. 2 loose bottles + 1 case) — they're kept as separate
  // lines, matched on (id, mode), and their combined unit usage is what's
  // capped against live stock.
  const perUnitOf = (mode, product) => mode === 'packet' ? (product?.unitsPerPacket || 1) : mode === 'half' ? halfPackUnits(product) : 1;
  const unitsOf = (item) => item.qty * perUnitOf(item.mode, item);
  const effPrice = (item) => item.mode === 'packet' ? (item.packetPrice || 0) : item.mode === 'half' ? (item.halfPacketPrice || 0) : item.price;

  // Never let the cart hold more units of a product than are actually on
  // the shelf — a sale that outruns stock just creates a refund/argument
  // later. Both the add button and the +/- stepper are capped here; the
  // backend re-checks the same thing at checkout in case stock changed
  // (another terminal sold it) since this cart was built.
  // A product with more than one size/color picks a specific variant first
  // (see the picker modal below); one with exactly one just adds it directly
  // — today's one-tap flow stays for simple, unsized accessories.
  const addToCart = (product, mode = 'unit', variant = null) => {
    const v = variant || variantsOf(product)[0];
    const perUnit = perUnitOf(mode, product);
    if (v.stock < perUnit) { toast(`${productName(product)} is out of stock`, 'error'); return false; }
    let added = true;
    setCart(prev => {
      const otherUnits = prev.filter(i => i.id === v.id && i.mode !== mode).reduce((s, i) => s + unitsOf(i), 0);
      const ex = prev.find(i => i.id === v.id && i.mode === mode);
      const nextQty = (ex?.qty || 0) + 1;
      if (nextQty * perUnit + otherUnits > v.stock) { added = false; return prev; }
      if (ex) return prev.map(i => (i.id === v.id && i.mode === mode) ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...product, ...v, productId: product.id, variantId: v.id, id: v.id, stock: v.stock, image: v.image || product.image, qty: 1, mode }];
    });
    if (!added) toast(`Only ${v.stock} ${productName(product)} in stock`, 'error');
    return added;
  };
  // Clicking a product tile: one variant adds straight to the cart; more
  // than one opens the size/color picker instead of guessing which to add.
  const handleTileClick = (p) => {
    const variants = variantsOf(p);
    if (variants.length > 1) setVariantPicker(p);
    else addToCart(p, 'unit', variants[0]);
  };
  const updateQty = (id, mode, delta) => setCart(prev => {
    const item = prev.find(i => i.id === id && i.mode === mode);
    const product = item && products.find(p => p.id === item.productId);
    const variant = product && variantsOf(product).find(v => v.id === id);
    const stock = variant?.stock ?? item?.stock ?? Infinity;
    const perUnit = perUnitOf(mode, product || item);
    const otherUnits = prev.filter(i => i.id === id && i.mode !== mode).reduce((s, i) => s + unitsOf(i), 0);
    const maxQty = perUnit > 0 ? Math.max(0, Math.floor((stock - otherUnits) / perUnit)) : 0;
    return prev.map(i => (i.id === id && i.mode === mode) ? { ...i, qty: Math.max(0, Math.min(maxQty, i.qty + delta)) } : i).filter(i => i.qty > 0);
  });
  const removeItem = (id, mode) => setCart(prev => prev.filter(i => !(i.id === id && i.mode === mode)));

  // "Scan": prompt for a SKU/barcode and add the matching variant (or the
  // product's own style SKU, for a simple single-variant product). Works
  // with USB/Bluetooth barcode scanners, which "type" the code then press Enter.
  const onScanCode = (raw) => {
    const code = (raw || '').trim();
    if (!code) return false;
    for (const p of products) {
      const v = variantsOf(p).find(v => (v.sku || '').toLowerCase() === code.toLowerCase());
      if (v) {
        const added = addToCart(p, 'unit', v);
        if (added) toast(`${productName(p)} added`);
        return added;
      }
    }
    const match = products.find(p => (p.sku || '').toLowerCase() === code.toLowerCase());
    if (match) {
      const added = addToCart(match);
      if (added) toast(`${productName(match)} added`);
      return added;
    }
    toast(`No product for code "${code}"`, 'error');
    return false;
  };
  const handleScan = () => setShowScan(true);

  // Autosensing barcode scanner — works without the modal or the search box
  // being focused. USB/Bluetooth scanners act as keyboards: they emit each
  // character in < 30 ms and terminate with Enter. We accumulate those chars
  // globally and fire onScanCode on Enter, but only when the user hasn't
  // deliberately focused a real text input (which handles its own input).
  const _onScanCode = useRef(null);
  _onScanCode.current = onScanCode;
  const _scanBuf  = useRef('');
  const _scanTick = useRef(null);
  useEffect(() => {
    if (showScan) return; // scan modal has its own focused input — don't double-handle
    const handler = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) return;
      if (e.key === 'Enter') {
        const code = _scanBuf.current.trim();
        _scanBuf.current = '';
        clearTimeout(_scanTick.current);
        if (code) _onScanCode.current?.(code);
        return;
      }
      if (e.key.length === 1) {
        _scanBuf.current += e.key;
        clearTimeout(_scanTick.current);
        // Reset if no new char arrives within 200 ms — scanner finishes in < 100 ms,
        // so anything slower is a stray human keypress, not a scan burst.
        _scanTick.current = setTimeout(() => { _scanBuf.current = ''; }, 200);
      }
    };
    window.addEventListener('keydown', handler);
    return () => { window.removeEventListener('keydown', handler); clearTimeout(_scanTick.current); };
  }, [showScan]);

  const subtotal = cart.reduce((s, i) => s + effPrice(i) * i.qty, 0);
  const discountAmt = Math.min(discount, subtotal);
  const discountedBase = subtotal - discountAmt;
  // TVA (VAT) has been removed — the shop doesn't charge sales tax. Kept as
  // a 0 constant (rather than deleting the field) since orders/reports/the
  // receipt still carry a tva column downstream; it's just always zero now.
  const tva = 0;
  // Clamped so removing cart items after redeeming (or a stale balance)
  // never lets points/credit discount more than what's actually left owing.
  const pointsUsed = customer ? Math.min(pointsRedeemed, customer.points || 0, Math.floor(discountedBase / FCFA_PER_POINT)) : 0;
  const pointsDiscountAmt = pointsUsed * FCFA_PER_POINT;
  const creditUsed = customer ? Math.min(creditApplied, customer.creditBalance || 0, discountedBase - pointsDiscountAmt) : 0;
  const total = discountedBase - pointsDiscountAmt - creditUsed;

  // A frozen copy of what was just bought, separate from the live cart —
  // the cart only empties once the cashier clicks "New order", but the
  // receipt (on screen and on the printout) still needs to show what was
  // in it even before that happens.
  const [completedOrder, setCompletedOrder] = useState(null);
  // Drives the customer-facing second screen: once payment succeeds it
  // switches to a thank-you message instead of still showing the (not yet
  // cleared) cart, without affecting what the cashier sees on this screen.
  const [justPaid, setJustPaid] = useState(false);

  // Mirror the live cart to a second-screen window via BroadcastChannel —
  // see customerDisplay.js / CustomerDisplay.jsx. Posting is a no-op if no
  // such window is open; there's no handshake needed either way.
  const customerChannel = useRef(null);
  useEffect(() => {
    customerChannel.current = new BroadcastChannel(CHANNEL_NAME);
    return () => customerChannel.current.close();
  }, []);
  const broadcastCart = () => {
    customerChannel.current?.postMessage({
      items: cart.map(i => ({ name: productName(i), size: i.size, color: i.color, price: effPrice(i), qty: i.qty, image: i.image || null, emoji: i.emoji || null })),
      subtotal, tva, total,
      customerName: customer?.name || null,
      paid: justPaid,
    });
  };
  useEffect(broadcastCart, [cart, subtotal, tva, total, customer, justPaid, lang]);

  // Points/credit are tied to a specific customer's balance — swapping (or
  // removing) the attached customer invalidates whatever was redeemed.
  useEffect(() => { setPointsRedeemed(0); setCreditApplied(0); }, [customer?.id]);

  // Core order creation — called directly (no discount) or after approval.
  const doCreateOrder = async (payload, snapshot) => {
    try {
      const order = await api.createOrder(payload);
      setCompletedOrder({ ...snapshot, invoiceNo: order.invoiceNo });
      setJustPaid(true);
      refresh();
      setShowReceipt(true);
    } catch (e) {
      if (!e.status) {
        queueMutation('order', payload);
        const invoiceNo = 'INV-' + new Date().getFullYear() + '-' + Math.floor(Math.random() * 9000 + 1000);
        setCompletedOrder({ ...snapshot, invoiceNo });
        setJustPaid(true);
        toast('Offline — sale saved, will sync automatically once back online', 'info');
        setShowReceipt(true);
      } else {
        toast(e.message, 'error');
      }
    }
  };

  const completePayment = async () => {
    if (cart.length === 0 || !activeCashier) return;
    const neededUnits = {};
    for (const item of cart) neededUnits[item.id] = (neededUnits[item.id] || 0) + unitsOf(item);
    for (const [variantId, units] of Object.entries(neededUnits)) {
      const item = cart.find(i => i.id === Number(variantId));
      const liveProduct = item && products.find(p => p.id === item.productId);
      const liveVariant = liveProduct && variantsOf(liveProduct).find(v => v.id === Number(variantId));
      if (liveVariant && liveVariant.stock < units) {
        toast(`Only ${liveVariant.stock} ${productName(liveProduct)} in stock — adjust the cart`, 'error');
        return;
      }
    }
    const clientOrderId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const payload = {
      items: cart.map(i => ({ productId: i.productId, variantId: i.id, name: i.name, sku: i.sku, size: i.size, color: i.color, price: effPrice(i), qty: i.qty, mode: i.mode })),
      customerId: customer?.id || null,
      method: paymentMethod, cashier: activeCashier.name, tva, discount: discountAmt, clientOrderId,
      storeId: currentStoreId || user?.storeId || 1,
      pointsRedeemed: pointsUsed, creditApplied: creditUsed,
    };
    const snapshot = { items: cart.map(i => ({ ...i, price: effPrice(i) })), subtotal, discount: discountAmt, pointsDiscountAmt, creditUsed, tva, total, customer, method: paymentMethod };

    if (discountAmt > 0) {
      // Submit for manager approval — order completes only once approved.
      try {
        const req = await api.createDiscountRequest({
          cashier: activeCashier.name, cashierId: activeCashier.id,
          items: cart.map(i => ({ id: i.id, name: i.name, qty: i.qty, price: effPrice(i) })),
          subtotal, discountAmt,
        });
        pendingOrderRef.current = { payload, snapshot };
        setDiscountRequestId(req.id);
      } catch (e) {
        toast(!e.status ? "Can't submit discount request while offline" : e.message, 'error');
      }
      return;
    }

    await doCreateOrder(payload, snapshot);
  };

  // Poll the discount request until the manager approves or rejects it.
  useEffect(() => {
    if (!discountRequestId) return;
    const poll = async () => {
      try {
        const result = await api.getDiscountRequest(discountRequestId);
        if (result.status === 'approved') {
          setDiscountRequestId(null);
          const pending = pendingOrderRef.current;
          pendingOrderRef.current = null;
          if (pending) await doCreateOrder(pending.payload, pending.snapshot);
        } else if (result.status === 'rejected') {
          setDiscountRequestId(null);
          pendingOrderRef.current = null;
          toast(`Discount not approved${result.note ? ': ' + result.note : ''}`, 'error');
        }
      } catch {}
    };
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [discountRequestId]); // eslint-disable-line

  const startNewOrder = () => { setCart([]); setDiscount(0); setPointsRedeemed(0); setCreditApplied(0); setShowReceipt(false); setCompletedOrder(null); setJustPaid(false); };

  return (
    <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
      <div className="flex-1 flex flex-col lg:overflow-hidden bg-gradient-to-br from-stone-50 via-white to-rose-50/30">
        <div className="px-4 sm:px-7 py-4 border-b border-stone-200/60 bg-white/60 backdrop-blur flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search_products')}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  // A hardware scanner types the code here then sends Enter.
                  if (onScanCode(search)) { setSearch(''); return; }
                  if (filtered.length === 1) { addToCart(filtered[0]); setSearch(''); }
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-100" />
            </div>
            <button onClick={handleScan} className="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-rose-900 text-white rounded-xl text-sm font-medium hover:bg-rose-800 shadow-sm flex-shrink-0">
              <Scan size={16} /><span className="hidden sm:inline">{t('scan')}</span>
            </button>
            <button onClick={() => setShowReturnModal(true)} title="Process a return or exchange"
              className="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-white border border-stone-200 text-stone-700 rounded-xl text-sm font-medium hover:bg-stone-50 shadow-sm flex-shrink-0">
              <RefreshCw size={16} /><span className="hidden sm:inline">Return</span>
            </button>
          </div>
        </div>

        <div className="px-4 sm:px-7 py-4 border-b border-stone-200/60 flex-shrink-0">
          <div className="flex flex-wrap gap-2">
            {categoryPills.map(cat => {
              const Icon = cat.icon;
              const active = activeCat === cat.id;
              return (
                <button key={cat.id} onClick={() => setActiveCat(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm whitespace-nowrap transition-all ${
                    active ? 'bg-stone-900 text-white shadow-sm' : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'
                  }`}>
                  <Icon size={15} strokeWidth={1.8} /><span className="font-medium">{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>


        <div className="lg:flex-1 lg:overflow-y-auto px-4 sm:px-7 py-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map(p => {
              const outOfStock = p.stock <= 0;
              const lowStock = !outOfStock && p.stock < lowStockThreshold;
              const hasPacket = p.packetPrice > 0 && p.unitsPerPacket > 0;
              const variants = variantsOf(p);
              return (
                <div key={p.id} role="button" tabIndex={outOfStock ? -1 : 0}
                  onClick={() => !outOfStock && handleTileClick(p)}
                  onKeyDown={e => { if (!outOfStock && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handleTileClick(p); } }}
                  className={`group relative bg-white rounded-2xl p-3.5 border text-left transition-all ${outOfStock ? 'border-stone-200/80 opacity-50 cursor-not-allowed' : 'border-stone-200/80 hover:border-rose-600 hover:shadow-lg hover:shadow-rose-900/5 cursor-pointer'}`}>
                  {outOfStock ? (
                    <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-medium rounded-md flex items-center gap-1">
                      <AlertTriangle size={9} /> {t('out_of_stock')}
                    </div>
                  ) : lowStock && (
                    <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-medium rounded-md flex items-center gap-1">
                      <AlertTriangle size={9} /> {t('low')}
                    </div>
                  )}
                  <div className="aspect-square rounded-xl bg-gradient-to-br from-stone-50 to-stone-100 flex items-center justify-center mb-3 text-4xl group-hover:scale-105 transition-transform overflow-hidden">
                    {p.image ? <img src={imageUrl(p.image)} alt="" className="w-full h-full object-cover" /> : p.emoji}
                  </div>
                  <div className="text-[11px] text-stone-400 font-mono mb-0.5">{p.sku}</div>
                  <div className="text-sm font-medium text-stone-900 leading-tight line-clamp-2 mb-1.5 min-h-[2.5em]">{productName(p)}</div>
                  <div className="flex items-end justify-between">
                    <div className="font-serif text-rose-900" style={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}>{fmt(p.price)}</div>
                    <div className="text-[10px] text-stone-500">{p.stock} {t('in_stock')}</div>
                  </div>
                  {variants.length > 1 && (
                    <div className="mt-1 text-[10px] text-stone-400">{variants.length} variants — tap to choose</div>
                  )}
                  {hasPacket && (
                    <div className="mt-2 grid grid-cols-1 gap-1">
                      {hasPacket && (
                        <button
                          onClick={e => { e.stopPropagation(); addToCart(p, 'packet'); }}
                          disabled={p.stock < p.unitsPerPacket}
                          className="flex items-center justify-center gap-1 px-2 py-1.5 bg-sky-50 text-sky-800 text-[11px] font-medium rounded-lg hover:bg-sky-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Package size={11} /> ×{p.unitsPerPacket} pack — {fmt(p.packetPrice)}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="w-full lg:w-[420px] bg-white border-t lg:border-t-0 lg:border-l border-stone-200/80 flex flex-col flex-shrink-0">
        <div className="p-5 border-b border-stone-200/80">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-widest text-stone-400 font-medium">{t('customer')}</div>
            <button
              onClick={() => {
                openCustomerDisplay();
                // BroadcastChannel has no message history — a freshly opened
                // window only sees what it's still listening for. Give it a
                // moment to load and attach its listener, then resend the
                // current cart so it's not just sitting on the empty state.
                setTimeout(broadcastCart, 800);
              }}
              title="Open a customer-facing cart display for a second screen"
              className="flex items-center gap-1 text-[11px] text-stone-500 hover:text-rose-700">
              <Monitor size={12} /> Customer display
            </button>
          </div>
          {customer ? (
            <div>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${TIER_COLOR[customer.tier]}`}>
                  {customer.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-stone-900 truncate">{customer.name}</div>
                  <span className="text-[10px] uppercase tracking-wider text-stone-500 font-medium">{customer.tier}</span>
                </div>
                <button onClick={() => setCustomer(null)} className="p-1.5 rounded-md hover:bg-stone-100"><X size={14} className="text-stone-400" /></button>
              </div>
              {(customer.points > 0 || customer.creditBalance > 0) && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2 pl-[52px]">
                  {customer.points > 0 && (pointsUsed > 0 ? (
                    <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-violet-50 text-violet-700 text-[11px] font-medium">
                      <Award size={10} /> {pointsUsed} pts · -{fmt(pointsDiscountAmt)}
                      <button onClick={() => setPointsRedeemed(0)} className="text-violet-400 hover:text-violet-700"><X size={10} /></button>
                    </span>
                  ) : (
                    <button onClick={() => setPointsRedeemed(customer.points)} disabled={discountedBase <= 0}
                      className="px-2 py-1 rounded-full border border-dashed border-violet-200 text-violet-600 hover:border-violet-400 text-[11px] font-medium disabled:opacity-40">
                      {customer.points} pts available — redeem
                    </button>
                  ))}
                  {customer.creditBalance > 0 && (creditUsed > 0 ? (
                    <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-teal-50 text-teal-700 text-[11px] font-medium">
                      <Wallet size={10} /> -{fmt(creditUsed)} credit
                      <button onClick={() => setCreditApplied(0)} className="text-teal-400 hover:text-teal-700"><X size={10} /></button>
                    </span>
                  ) : (
                    <button onClick={() => setCreditApplied(customer.creditBalance)} disabled={discountedBase <= 0}
                      className="px-2 py-1 rounded-full border border-dashed border-teal-200 text-teal-600 hover:border-teal-400 text-[11px] font-medium disabled:opacity-40">
                      {fmt(customer.creditBalance)} credit available — use
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 flex-shrink-0">
                <UserCircle2 size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-stone-900 truncate">{t('walk_in_customer')}</div>
                <div className="text-xs text-stone-400">{t('no_loyalty_account')}</div>
              </div>
              <button onClick={() => setShowCustomerPicker(true)} className="text-xs text-rose-700 hover:text-rose-900 font-medium flex-shrink-0">{t('add')}</button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] uppercase tracking-widest text-stone-400 font-medium">{t('order')} · {cart.length} {t('items')}</div>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="text-[11px] text-stone-500 hover:text-rose-600 flex items-center gap-1">
                <Trash2 size={11} /> {t('clear')}
              </button>
            )}
          </div>
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mb-3"><ShoppingCart size={24} className="text-stone-400" /></div>
              <div className="text-sm text-stone-500">{t('cart_empty')}</div>
              <div className="text-xs text-stone-400 mt-1">{t('tap_to_add')}</div>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map(item => (
                <div key={`${item.id}-${item.mode}`} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-stone-50 group">
                  <div className="w-14 h-14 rounded-lg bg-stone-100 flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden">{item.image ? <img src={imageUrl(item.image)} alt="" className="w-full h-full object-cover" /> : item.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-stone-900 truncate">
                      {productName(item)}
                      {item.mode === 'packet' && <span className="ml-1.5 px-1.5 py-0.5 bg-sky-50 text-sky-700 text-[10px] font-medium rounded">×{item.unitsPerPacket} pack</span>}
                      {item.mode === 'half' && <span className="ml-1.5 px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-medium rounded">½ pack (×{halfPackUnits(item)})</span>}
                    </div>
                    <div className="text-xs text-stone-500">
                      {fmt(effPrice(item))}
                      {(item.size && item.size !== 'One Size') || item.color ? (
                        <span className="ml-1.5 text-stone-400">· {[item.size, item.color].filter(Boolean).join(' / ')}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-stone-100 rounded-lg p-0.5">
                    <button onClick={() => updateQty(item.id, item.mode, -1)} className="w-6 h-6 rounded-md hover:bg-white flex items-center justify-center"><Minus size={12} /></button>
                    <span className="w-7 text-center text-sm font-medium">{item.qty}</span>
                    <button onClick={() => updateQty(item.id, item.mode, 1)} className="w-6 h-6 rounded-md hover:bg-white flex items-center justify-center"><Plus size={12} /></button>
                  </div>
                  <button onClick={() => removeItem(item.id, item.mode)} className="opacity-0 group-hover:opacity-100 p-1 text-stone-400 hover:text-rose-600"><X size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-stone-200/80 p-5 bg-stone-50/50 flex-shrink-0">
          <div className="space-y-1.5 mb-4 text-sm">
            <div className="flex justify-between text-stone-600"><span>{t('subtotal')}</span><span>{fmt(subtotal)}</span></div>
            {discountAmt > 0 ? (
              <div className="flex justify-between items-center text-rose-600 font-medium">
                <span className="flex items-center gap-1"><Percent size={11} /> Discount</span>
                <span className="flex items-center gap-1.5">
                  -{fmt(discountAmt)}
                  <button onClick={() => setDiscount(0)} className="text-rose-400 hover:text-rose-600 transition-colors" title="Remove discount">
                    <X size={12} />
                  </button>
                </span>
              </div>
            ) : cart.length > 0 && (
              <button onClick={() => setShowDiscount(true)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-stone-400 hover:text-rose-700 border border-dashed border-stone-200 hover:border-rose-300 rounded-lg transition-all">
                <Percent size={11} /> Add discount
              </button>
            )}
            {pointsDiscountAmt > 0 && (
              <div className="flex justify-between items-center text-violet-600 font-medium">
                <span className="flex items-center gap-1"><Award size={11} /> Points ({pointsUsed})</span>
                <span>-{fmt(pointsDiscountAmt)}</span>
              </div>
            )}
            {creditUsed > 0 && (
              <div className="flex justify-between items-center text-teal-600 font-medium">
                <span className="flex items-center gap-1"><Wallet size={11} /> Store credit</span>
                <span>-{fmt(creditUsed)}</span>
              </div>
            )}
            <div className="h-px bg-stone-200 my-2" />
            <div className="flex justify-between items-baseline">
              <span className="text-stone-900 font-medium">{t('total')}</span>
              <span className="font-serif text-2xl text-stone-900" style={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}>{fmt(total)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5 mb-3">
            {[
              { id: 'cash', icon: Banknote, label: t('cash') },
              { id: 'mobile', icon: Smartphone, label: t('mobile') },
            ].map(m => {
              const Icon = m.icon;
              const active = paymentMethod === m.id;
              return (
                <button key={m.id} onClick={() => setPaymentMethod(m.id)}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-lg border transition-all ${
                    active ? 'border-rose-900 bg-rose-900 text-white' : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                  }`}>
                  <Icon size={16} strokeWidth={1.8} /><span className="text-[11px] font-medium">{m.label}</span>
                </button>
              );
            })}
          </div>

          {!activeCashier && (
            <div className="mb-3 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2">
              <AlertTriangle size={15} className="text-amber-700 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-amber-900 leading-snug">
                <div className="font-semibold">No cashier on the clock</div>
                <div className="text-amber-800">
                  {isHandheldUA(navigator.userAgent)
                    ? 'Clock in from the POS terminal to accept payments.'
                    : 'Open the Shifts view and clock in a cashier to accept payments.'}
                </div>
              </div>
            </div>
          )}
          {activeCashier && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-900">Cashier: <span className="font-semibold">{activeCashier.name}</span></span>
            </div>
          )}
          <button onClick={completePayment} disabled={cart.length === 0 || !activeCashier}
            className="w-full py-3.5 bg-gradient-to-r from-rose-700 to-rose-900 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-rose-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
            <CheckCircle2 size={18} />{t('complete_payment')}
          </button>
        </div>
      </div>

      <ReceiptModal open={showReceipt} onClose={() => setShowReceipt(false)} data={completedOrder} onNewOrder={startNewOrder} />
      <ScanModal open={showScan} onClose={() => setShowScan(false)} onScan={onScanCode} />
      <DiscountInputModal open={showDiscount} onClose={() => setShowDiscount(false)} onApply={setDiscount} subtotal={subtotal} />
      <VariantPickerModal product={variantPicker} onClose={() => setVariantPicker(null)}
        onPick={(v) => { addToCart(variantPicker, 'unit', v); setVariantPicker(null); }} />
      <ReturnRequestModal open={showReturnModal} onClose={() => setShowReturnModal(false)} />

      {/* Cashier waiting overlay — shown while manager reviews the discount request */}
      {discountRequestId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-80 text-center">
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <Percent size={28} className="text-amber-600" />
            </div>
            <div className="font-semibold text-stone-900 text-lg mb-1">Awaiting Approval</div>
            <div className="text-rose-600 font-medium text-sm mb-1">Discount: -{fmt(discountAmt)}</div>
            <div className="text-stone-400 text-xs mb-6">A manager needs to approve this discount before the receipt can print.</div>
            <div className="flex justify-center gap-2 mb-6">
              {[0,1,2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: `${i * 0.18}s` }} />
              ))}
            </div>
            <button onClick={async () => {
              try { await api.cancelDiscountRequest(discountRequestId); } catch {}
              setDiscountRequestId(null); pendingOrderRef.current = null;
            }} className="text-xs text-stone-400 hover:text-stone-600 transition-colors underline underline-offset-2">
              Cancel request
            </button>
          </div>
        </div>
      )}

      <Modal open={showCustomerPicker} onClose={() => setShowCustomerPicker(false)} title={t('add_customer')}>
        <div className="space-y-1">
          {customerList.map(c => (
            <button key={c.id} onClick={() => { setCustomer(c); setShowCustomerPicker(false); }}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-stone-50 text-left">
              <div>
                <div className="text-sm font-medium text-stone-900">{c.name}</div>
                <div className="text-xs text-stone-500">{c.phone}</div>
              </div>
              <span className="text-xs text-stone-500">{c.tier}</span>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
};

// ============ DASHBOARD ============
const DashboardView = () => {
  const { t, lang } = useT();
  const { online, products: liveProducts, customers: liveCustomers, settings } = useData();
  const products = online ? (liveProducts || []) : (liveProducts?.length ? liveProducts : PRODUCTS);
  const customers = online ? (liveCustomers || []) : (liveCustomers?.length ? liveCustomers : CUSTOMERS);
  const lowStockThreshold = Number(settings?.lowStockThreshold) || 10;
  const categoryList = useCategoryList();
  const [range, setRange] = useState('7D');
  const [report, setReport] = useState(null);
  const [profitability, setProfitability] = useState([]);
  const [monthPnl, setMonthPnl] = useState(null);
  const [todayPnl, setTodayPnl] = useState(null);

  // Pull live totals when the backend is up. Re-fetches whenever the
  // 7D/30D/90D range changes (controls how much history to ask for), and
  // whenever `liveProducts` gets a new reference — that happens on every
  // global refresh() call, including after "Clear all data" in Settings, so
  // these reports don't keep showing stale numbers from before a reset.
  const daysFor = (r) => ({ '7D': 7, '30D': 30, '90D': 90 }[r] || 7);
  useEffect(() => {
    if (!online) return;
    api.salesReport(daysFor(range)).then(setReport).catch(() => {});
  }, [online, range, liveProducts]);
  useEffect(() => {
    if (!online) return;
    api.profitabilityReport(5).then(setProfitability).catch(() => {});
    const today = new Date();
    const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    const todayStr = today.toISOString().slice(0, 10);
    api.pnlReport(monthStart, todayStr).then(setMonthPnl).catch(() => {});
    api.pnlReport(todayStr, todayStr).then(setTodayPnl).catch(() => {});
  }, [online, liveProducts]);

  // Real daily revenue for the selected window, with a readable date label.
  const chartData = useMemo(() => (report?.daily || []).map(d => ({
    ...d,
    label: new Date(d.day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
  })), [report]);

  // Real category breakdown for the same window, replacing the old empty
  // placeholder pie chart. Colors cycle through a small fixed palette.
  const PIE_COLORS = ['#047857', '#f59e0b', '#0ea5e9', '#e11d48', '#8b5cf6', '#14b8a6', '#f97316'];
  const categoryBreakdown = useMemo(() => {
    const rows = report?.byCategory || [];
    const total = rows.reduce((s, r) => s + r.sales, 0);
    return rows.map((r, i) => {
      const cat = categoryList.find(c => c.id === r.category);
      return {
        name: cat ? cat.label : r.category,
        value: total ? Math.round((r.sales / total) * 100) : 0,
        color: PIE_COLORS[i % PIE_COLORS.length],
      };
    });
  }, [report, categoryList]);

  const lowCount = products.filter(p => p.stock < lowStockThreshold).length;
  const todaysSales = report?.totals?.revenue != null ? fmt(report.totals.revenue) : '0 FCFA';
  const ordersCount = report?.totals?.orders != null ? String(report.totals.orders) : '0';

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-br from-stone-50 via-white to-rose-50/20 p-4 sm:p-7">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
        <KpiCard label={t('todays_sales')} value={todaysSales} icon={TrendingUp} accent="bg-rose-50 text-rose-700" />
        <KpiCard
          label={lang === 'fr' ? "Profit du jour" : "Today's Profit"}
          value={todayPnl ? fmt(todayPnl.netProfit) : '0 FCFA'}
          icon={Wallet}
          accent={todayPnl && todayPnl.netProfit < 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}
        />
        <KpiCard label={t('orders')} value={ordersCount} icon={Receipt} accent="bg-amber-50 text-amber-700" />
        {/* Every checkout counts as one customer served — most sales are
            walk-ins with no loyalty record attached, so customers.length
            would otherwise undercount actual foot traffic. */}
        <KpiCard label={t('customers')} value={ordersCount} icon={Users} accent="bg-rose-50 text-rose-700" />
        <KpiCard label={t('low_stock_items')} value={String(lowCount)} icon={AlertTriangle} accent="bg-orange-50 text-orange-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-stone-200/80">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-serif text-lg text-stone-900" style={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}>
                {lang === 'fr' ? 'Ventes' : 'Sales'} — {{ '7D': lang === 'fr' ? '7 derniers jours' : 'last 7 days', '30D': lang === 'fr' ? '30 derniers jours' : 'last 30 days', '90D': lang === 'fr' ? '90 derniers jours' : 'last 90 days' }[range]}
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">{lang === 'fr' ? 'Revenu réel des ventes enregistrées' : 'Real revenue from recorded sales'}</p>
            </div>
            <div className="flex gap-1 text-xs">
              {['7D', '30D', '90D'].map((p) => (
                <button key={p} onClick={() => setRange(p)} className={`px-3 py-1.5 rounded-md font-medium ${range === p ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'}`}>{p}</button>
              ))}
            </div>
          </div>
          {chartData.length === 0 ? (
            <div className="h-[240px] flex items-center justify-center text-sm text-stone-400">No sales recorded yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e11d48" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#e11d48" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
                <XAxis dataKey="label" stroke="#a8a29e" fontSize={11} axisLine={false} tickLine={false} />
                <YAxis stroke="#a8a29e" fontSize={11} axisLine={false} tickLine={false} tickFormatter={fmtShort} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 12 }} formatter={(v) => fmt(v)} />
                <Area type="monotone" dataKey="sales" stroke="#e11d48" strokeWidth={2.5} fill="url(#grad1)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-2xl p-5 border border-stone-200/80">
          <h3 className="font-serif text-lg text-stone-900 mb-1" style={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}>{t('by_category')}</h3>
          <p className="text-xs text-stone-500 mb-3">{t('share_of_sales')}</p>
          {categoryBreakdown.length === 0 ? (
            <div className="h-[180px] flex items-center justify-center text-sm text-stone-400">No sales recorded yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={categoryBreakdown} dataKey="value" innerRadius={45} outerRadius={75} paddingAngle={2}>
                  {categoryBreakdown.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="space-y-1.5 mt-2">
            {categoryBreakdown.slice(0, 4).map(c => (
              <div key={c.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                  <span className="text-stone-700">{c.name}</span>
                </div>
                <span className="font-medium text-stone-900">{c.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-stone-200/80">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-serif text-lg text-stone-900" style={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}>Most profitable products</h3>
              <p className="text-xs text-stone-500 mt-0.5">Ranked by actual profit contribution, not just units sold</p>
            </div>
          </div>
          {profitability.length === 0 ? (
            <div className="text-sm text-stone-400 py-6 text-center">No sales recorded yet.</div>
          ) : (
            <div className="space-y-2.5">
              {profitability.map((p, i) => {
                const maxProfit = profitability[0]?.grossProfit || 1;
                return (
                  <div key={p.productId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-stone-50">
                    <div className="w-7 h-7 rounded-md bg-stone-100 flex items-center justify-center text-xs font-mono text-stone-500">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-stone-900 truncate">{p.name}</div>
                      <div className="text-xs text-stone-500 truncate">{p.sku}</div>
                    </div>
                    <div className="hidden sm:block flex-1 max-w-[180px]">
                      <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-700 rounded-full" style={{ width: `${Math.max(4, (p.grossProfit / maxProfit) * 100)}%` }} />
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-medium text-stone-900">{fmt(p.grossProfit)}</div>
                      <div className="text-xs text-stone-500">{p.unitsSold} sold · {p.marginPct.toFixed(0)}% margin</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-gradient-to-br from-rose-900 via-rose-800 to-stone-900 rounded-2xl p-5 text-white relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-rose-600/20 blur-2xl" />
          <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full bg-amber-400/10 blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <Wallet size={16} className="text-amber-300" />
              <span className="text-[11px] uppercase tracking-widest text-amber-200/80 font-medium">This month</span>
            </div>
            <h3 className="font-serif text-xl leading-tight mb-2" style={{ fontFamily: "'Fraunces', serif", fontWeight: 500 }}>
              {monthPnl ? fmt(monthPnl.netProfit) : '—'} net profit
            </h3>
            <p className="text-sm text-stone-300 mb-4">
              {monthPnl ? `${fmt(monthPnl.revenue)} revenue − ${fmt(monthPnl.cogs)} COGS − ${fmt(monthPnl.totalExpenses)} expenses` : 'Connect to the backend to see this month’s figures.'}
            </p>
            {monthPnl && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs"><span className="text-stone-300">Net margin</span><span className="font-medium">{monthPnl.netMarginPct.toFixed(1)}%</span></div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${monthPnl.netProfit >= 0 ? 'bg-gradient-to-r from-amber-400 to-amber-300' : 'bg-rose-400'}`} style={{ width: `${Math.min(100, Math.max(4, Math.abs(monthPnl.netMarginPct)))}%` }} />
                </div>
              </div>
            )}
            <button onClick={() => {
                if (!monthPnl) return;
                const rows = [['Month-to-date P&L', `${monthPnl.from} to ${monthPnl.to}`], [], ['Revenue', monthPnl.revenue], ['COGS', monthPnl.cogs], ['Gross profit', monthPnl.grossProfit], ['Expenses', monthPnl.totalExpenses], ['Net profit', monthPnl.netProfit]];
                downloadCsv(`dashboard-pnl-${new Date().toISOString().slice(0, 10)}.csv`, rows);
              }} className="mt-5 text-xs flex items-center gap-1 text-amber-300 hover:text-amber-200">
              {t('view_report')} <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============ INVENTORY — with tabs ============
const InventoryView = () => {
  const { t } = useT();
  const { can } = useRole();
  const [tab, setTab] = useState('products');
  const tabs = [
    { id: 'products', label: t('products'), icon: Package },
    { id: 'suppliers', label: t('suppliers'), icon: Truck },
    { id: 'purchase', label: t('purchase_orders'), icon: ClipboardList },
    { id: 'movements', label: t('stock_movements'), icon: RefreshCw },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-stone-50/30">
      {/* Sub-nav tabs */}
      <div className="px-4 sm:px-7 pt-5 sticky top-0 bg-stone-50/80 backdrop-blur z-10 border-b border-stone-200/60">
        <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {tabs.map(tb => {
            const Icon = tb.icon;
            const active = tab === tb.id;
            return (
              <button key={tb.id} onClick={() => setTab(tb.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap flex-shrink-0 ${
                  active ? 'text-rose-900 border-rose-900' : 'text-stone-500 border-transparent hover:text-stone-900'
                }`}>
                <Icon size={15} strokeWidth={1.8} />{tb.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4 sm:p-7">
        {tab === 'products' && <ProductsPanel />}
        {tab === 'suppliers' && <SuppliersPanel />}
        {tab === 'purchase' && <PurchaseOrdersPanel />}
        {tab === 'movements' && <StockMovementsPanel />}
      </div>
    </div>
  );
};

const ProductsPanel = () => {
  const { t } = useT();
  const { can } = useRole();
  const { toast } = useToast();
  const { products: liveProducts, online, settings, patch } = useData();
  const products = online ? (liveProducts || []) : (liveProducts?.length ? liveProducts : PRODUCTS);
  const lowStockThreshold = Number(settings?.lowStockThreshold) || 10;
  const categoryList = useCategoryList();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date_registered');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [editingCost, setEditingCost] = useState(null); // { id, value }
  const [editingPrice, setEditingPrice] = useState(null); // { id, value }
  const [editingPacket, setEditingPacket] = useState(null); // { id, price, units }
  const filtered = products.filter(p => {
    if (filter === 'low' && p.stock >= lowStockThreshold) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.sku.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const SORTERS = {
    date_modified: (a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0),
    date_registered: (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
    name_az: (a, b) => a.name.localeCompare(b.name),
    name_za: (a, b) => b.name.localeCompare(a.name),
    stock_high: (a, b) => b.stock - a.stock,
    stock_low: (a, b) => a.stock - b.stock,
    price_high: (a, b) => b.price - a.price,
    price_low: (a, b) => a.price - b.price,
  };
  const sorted = [...filtered].sort(SORTERS[sortBy] || SORTERS.date_registered);
  const exportProducts = () => {
    const rows = [['Name', 'SKU', 'Category', 'Price', 'Stock']];
    sorted.forEach(p => rows.push([p.name, p.sku, p.category, p.price, p.stock]));
    downloadCsv(`products-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };
  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (p) => { setEditing(p); setModalOpen(true); };

  const allSelected = filtered.length > 0 && filtered.every(p => selected.has(p.id));
  const someSelected = selected.size > 0;
  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(filtered.map(p => p.id)));
  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selected.size} product${selected.size === 1 ? '' : 's'}? This cannot be undone.`)) return;
    setDeleting(true);
    const ids = [...selected];
    try {
      await Promise.all(ids.map(id => api.deleteProduct(id)));
      patch('products', list => list.filter(p => !ids.includes(p.id)));
      setSelected(new Set());
      toast(`Deleted ${ids.length} product${ids.length === 1 ? '' : 's'}`);
    } catch (e) { toast(e.message || 'Delete failed', 'error'); }
    setDeleting(false);
  };
  const handleDeleteOne = async (p) => {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    try {
      await api.deleteProduct(p.id);
      patch('products', list => list.filter(x => x.id !== p.id));
      setSelected(prev => { const next = new Set(prev); next.delete(p.id); return next; });
      toast(`Deleted ${p.name}`);
    } catch (e) { toast(e.message || 'Delete failed', 'error'); }
  };
  const saveCost = async (p, rawValue) => {
    const newCost = parseFloat(rawValue);
    setEditingCost(null);
    if (isNaN(newCost) || newCost === p.cost) return;
    try {
      const updated = await api.updateProduct(p.id, { ...p, cost: newCost });
      patch('products', list => list.map(x => x.id === p.id ? updated : x));
    } catch (e) { toast(e.message || 'Failed to save cost', 'error'); }
  };
  const savePrice = async (p, rawValue) => {
    const newPrice = parseFloat(rawValue);
    setEditingPrice(null);
    if (isNaN(newPrice) || newPrice === p.price) return;
    try {
      const updated = await api.updateProduct(p.id, { ...p, price: newPrice });
      patch('products', list => list.map(x => x.id === p.id ? updated : x));
    } catch (e) { toast(e.message || 'Failed to save price', 'error'); }
  };
  const savePacket = async (p, rawPrice, rawUnits) => {
    const newPacketPrice = parseFloat(rawPrice) || 0;
    const newUnitsPerPacket = parseInt(rawUnits) || 0;
    setEditingPacket(null);
    if (newPacketPrice === (p.packetPrice || 0) && newUnitsPerPacket === (p.unitsPerPacket || 0)) return;
    try {
      const updated = await api.updateProduct(p.id, { ...p, packetPrice: newPacketPrice, unitsPerPacket: newUnitsPerPacket });
      patch('products', list => list.map(x => x.id === p.id ? updated : x));
    } catch (e) { toast(e.message || 'Failed to save packet price', 'error'); }
  };
  // Scan handler: shared by both the modal and the autosensing listener.
  // Existing SKU → show in search results. New barcode → open Add form pre-filled.
  const handleScanToAdd = (raw) => {
    const code = (raw || '').trim();
    if (!code) return false;
    setScanOpen(false);
    const match = products.find(p => (p.sku || '').toLowerCase() === code.toLowerCase());
    if (match) {
      setSearch(code);
      toast(`Found: ${match.name}`, 'info');
    } else {
      setEditing({ name: '', name_fr: '', category: categoryList[0]?.id || 'cosmetics', price: 0, cost: 0, stock: 0, sku: code, emoji: '📦', image: null });
      toast('New barcode — fill in the product details', 'info');
      setModalOpen(true);
    }
    return true;
  };

  // Autosensing barcode scanner — active as soon as the Inventory page loads,
  // no button press needed. USB/Bluetooth scanners type each character in < 30 ms
  // then send Enter; we accumulate and dispatch to handleScanToAdd.
  // Paused while a modal is open (modals have their own focused inputs).
  const _invScanRef = useRef(null);
  _invScanRef.current = handleScanToAdd;
  const _invBuf  = useRef('');
  const _invTick = useRef(null);
  useEffect(() => {
    if (modalOpen || scanOpen) return;
    const handler = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) return;
      if (e.key === 'Enter') {
        const code = _invBuf.current.trim();
        _invBuf.current = '';
        clearTimeout(_invTick.current);
        if (code) _invScanRef.current?.(code);
        return;
      }
      if (e.key.length === 1) {
        _invBuf.current += e.key;
        clearTimeout(_invTick.current);
        _invTick.current = setTimeout(() => { _invBuf.current = ''; }, 200);
      }
    };
    window.addEventListener('keydown', handler);
    return () => { window.removeEventListener('keydown', handler); clearTimeout(_invTick.current); };
  }, [modalOpen, scanOpen]);
  const stockValue = products.reduce((sum, p) => sum + p.price * p.stock, 0);
  const lowStockCount = products.filter(p => p.stock > 0 && p.stock < lowStockThreshold).length;
  const outOfStockCount = products.filter(p => p.stock === 0).length;

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KpiCard label={t('total_skus')} value={products.length.toLocaleString()} icon={Package} accent="bg-rose-50 text-rose-700" />
        <KpiCard label={t('stock_value')} value={`${fmtShort(stockValue)} FCFA`} icon={Wallet} accent="bg-amber-50 text-amber-700" />
        <KpiCard label={t('low_stock_items')} value={String(lowStockCount)} icon={AlertTriangle} accent="bg-orange-50 text-orange-700" />
        <KpiCard label={t('out_of_stock')} value={String(outOfStockCount)} icon={X} accent="bg-rose-50 text-rose-700" />
      </div>

      <div className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-stone-200/80 flex items-center gap-3 flex-wrap">
          {/* Pulsing dot — tells staff the scanner is hot and ready */}
          <div className="order-0 flex items-center gap-1.5 text-xs text-emerald-700 font-medium flex-shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            Scanner active
          </div>
          <div className="relative flex-1 min-w-full sm:min-w-0 sm:max-w-md order-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search_products')}
              className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-rose-600" />
          </div>
          <div className="flex gap-1 order-2">
            {[{ id: 'all', label: t('all') }, { id: 'low', label: t('low_stock') }].map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)}
                className={`px-3 py-2 rounded-lg text-xs font-medium ${filter === f.id ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'}`}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative order-2 flex-shrink-0">
            <ArrowUpDown size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} title={t('sort_by')}
              className="pl-7 pr-6 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-medium text-stone-600 focus:outline-none focus:border-rose-600 appearance-none cursor-pointer">
              <option value="date_registered">{t('sort_date_registered')}</option>
              <option value="date_modified">{t('sort_date_modified')}</option>
              <option value="name_az">{t('sort_name_az')}</option>
              <option value="name_za">{t('sort_name_za')}</option>
              <option value="stock_high">{t('sort_stock_high')}</option>
              <option value="stock_low">{t('sort_stock_low')}</option>
              <option value="price_high">{t('sort_price_high')}</option>
              <option value="price_low">{t('sort_price_low')}</option>
            </select>
          </div>
          <button onClick={exportProducts} className="sm:ml-auto order-3 flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-lg">
            <Download size={14} /> {t('export')}
          </button>
          {can.addProducts && (
            <button onClick={() => setCatsOpen(true)} className="order-4 flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-stone-200 text-stone-700 rounded-lg hover:bg-stone-50">
              <LayoutGrid size={14} /> Categories
            </button>
          )}
          {can.addProducts && (
            <button onClick={() => setScanOpen(true)} className="order-4 flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-stone-200 text-stone-700 rounded-lg hover:bg-stone-50">
              <Scan size={14} /> Scan to add
            </button>
          )}
          {can.addProducts && (
            <button onClick={openAdd} className="order-4 flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-rose-900 text-white rounded-lg hover:bg-rose-800">
              <Plus size={14} /> {t('add_product')}
            </button>
          )}
        </div>

        {someSelected && can.editInventory && (
          <div className="px-5 py-2.5 bg-rose-50 border-b border-rose-200 flex items-center gap-3">
            <span className="text-sm text-rose-800 font-medium">{selected.size} selected</span>
            <button onClick={() => setSelected(new Set())} className="text-xs text-rose-600 hover:text-rose-900">Clear</button>
            <button onClick={handleBulkDelete} disabled={deleting}
              className="ml-auto flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-rose-700 text-white rounded-lg hover:bg-rose-800 disabled:opacity-50">
              <Trash2 size={13} /> {deleting ? 'Deleting…' : `Delete ${selected.size}`}
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-widest text-stone-500 font-medium border-b border-stone-200/80">
              {can.editInventory && (
                <th className="pl-5 pr-2 py-3 w-8">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll}
                    className="h-4 w-4 rounded border-stone-300 text-rose-600 accent-rose-600 cursor-pointer" />
                </th>
              )}
              <th className="px-5 py-3">{t('product')}</th>
              <th className="px-3 py-3">SKU</th>
              <th className="px-3 py-3">{t('category')}</th>
              <th className="px-3 py-3">{t('price')}</th>
              <th className="px-3 py-3">Cost</th>
              <th className="px-3 py-3">Packet</th>
              <th className="px-3 py-3">{t('stock')}</th>
              <th className="px-3 py-3">{t('status')}</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(p => {
              const cat = categoryList.find(c => c.id === p.category);
              const lowStock = p.stock < lowStockThreshold;
              const isSelected = selected.has(p.id);
              return (
                <tr key={p.id} className={`border-b border-stone-100 hover:bg-stone-50/50 ${isSelected ? 'bg-rose-50/40' : ''}`}>
                  {can.editInventory && (
                    <td className="pl-5 pr-2 py-3 w-8">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(p.id)}
                        className="h-4 w-4 rounded border-stone-300 text-rose-600 accent-rose-600 cursor-pointer" />
                    </td>
                  )}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-stone-50 to-stone-100 flex items-center justify-center text-xl overflow-hidden">{p.image ? <img src={imageUrl(p.image)} alt="" className="w-full h-full object-cover" /> : p.emoji}</div>
                      <div className="text-sm font-medium text-stone-900">{p.name}</div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs font-mono text-stone-500">{p.sku}</td>
                  <td className="px-3 py-3"><span className="text-xs text-stone-700">{cat ? cat.label : p.category}</span></td>
                  <td className="px-3 py-3">
                    {can.editInventory && editingPrice?.id === p.id ? (
                      <input
                        type="number"
                        autoFocus
                        defaultValue={editingPrice.value}
                        onBlur={e => savePrice(p, e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') e.target.blur();
                          if (e.key === 'Escape') setEditingPrice(null);
                        }}
                        className="w-24 px-2 py-1 text-sm border border-rose-400 rounded focus:outline-none focus:ring-1 focus:ring-rose-500 bg-rose-50"
                      />
                    ) : (
                      <button
                        onClick={() => can.editInventory && setEditingPrice({ id: p.id, value: p.price || 0 })}
                        className={`text-sm font-medium text-stone-900 ${can.editInventory ? 'hover:text-rose-700 hover:underline cursor-pointer' : 'cursor-default'}`}
                        title={can.editInventory ? 'Click to edit price' : undefined}
                      >
                        {fmt(p.price)}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {can.editInventory && editingCost?.id === p.id ? (
                      <input
                        type="number"
                        autoFocus
                        defaultValue={editingCost.value}
                        onBlur={e => saveCost(p, e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') e.target.blur();
                          if (e.key === 'Escape') setEditingCost(null);
                        }}
                        className="w-24 px-2 py-1 text-sm border border-amber-400 rounded focus:outline-none focus:ring-1 focus:ring-amber-500 bg-amber-50"
                      />
                    ) : (
                      <button
                        onClick={() => can.editInventory && setEditingCost({ id: p.id, value: p.cost || 0 })}
                        className={`text-sm text-stone-600 ${can.editInventory ? 'hover:text-amber-700 hover:underline cursor-pointer' : 'cursor-default'}`}
                        title={can.editInventory ? 'Click to edit cost' : undefined}
                      >
                        {p.cost > 0 ? fmt(p.cost) : <span className="text-stone-300 text-xs">— set cost</span>}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {can.editInventory && editingPacket?.id === p.id ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            autoFocus
                            value={editingPacket.price}
                            onChange={e => setEditingPacket(v => ({ ...v, price: e.target.value }))}
                            onKeyDown={e => {
                              if (e.key === 'Enter') savePacket(p, editingPacket.price, editingPacket.units);
                              if (e.key === 'Escape') setEditingPacket(null);
                            }}
                            placeholder="Price"
                            className="w-16 px-1.5 py-1 text-sm border border-sky-400 rounded focus:outline-none focus:ring-1 focus:ring-sky-500 bg-sky-50"
                          />
                          <span className="text-stone-400 text-xs">/</span>
                          <input
                            type="number"
                            value={editingPacket.units}
                            onChange={e => setEditingPacket(v => ({ ...v, units: e.target.value }))}
                            onKeyDown={e => {
                              if (e.key === 'Enter') savePacket(p, editingPacket.price, editingPacket.units);
                              if (e.key === 'Escape') setEditingPacket(null);
                            }}
                            placeholder="Units"
                            className="w-12 px-1.5 py-1 text-sm border border-sky-400 rounded focus:outline-none focus:ring-1 focus:ring-sky-500 bg-sky-50"
                          />
                          <button onClick={() => savePacket(p, editingPacket.price, editingPacket.units)} className="text-rose-600 hover:text-rose-800" title="Save">
                            <CheckCircle2 size={15} />
                          </button>
                          <button onClick={() => setEditingPacket(null)} className="text-stone-400 hover:text-rose-600" title="Cancel">
                            <X size={15} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => can.editInventory && setEditingPacket({ id: p.id, price: p.packetPrice || 0, units: p.unitsPerPacket || 0 })}
                        className={`text-sm text-stone-600 ${can.editInventory ? 'hover:text-sky-700 hover:underline cursor-pointer' : 'cursor-default'}`}
                        title={can.editInventory ? 'Click to edit packet price / size' : undefined}
                      >
                        {p.packetPrice > 0 && p.unitsPerPacket > 0
                          ? <>{fmt(p.packetPrice)} <span className="text-stone-400 text-xs">/ {p.unitsPerPacket}</span></>
                          : <span className="text-stone-300 text-xs">— set packet</span>}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-stone-900">{p.stock}</span>
                      <div className="w-16 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${lowStock ? 'bg-amber-500' : 'bg-emerald-600'}`} style={{ width: `${Math.min(100, (p.stock / 100) * 100)}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    {lowStock ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-800 text-[10px] font-medium rounded-md">
                        <AlertTriangle size={10} /> {t('low_stock')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-medium rounded-md">
                        <CheckCircle2 size={10} /> {t('in_stock')}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {can.editInventory && (
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => openEdit(p)} className="text-xs text-stone-500 hover:text-stone-900">{t('edit')}</button>
                        <button onClick={() => handleDeleteOne(p)} className="text-stone-300 hover:text-rose-600 transition-colors" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
      <ProductForm open={modalOpen} onClose={() => setModalOpen(false)} initial={editing} />
      <ScanModal open={scanOpen} onClose={() => setScanOpen(false)} onScan={handleScanToAdd}
        title="Scan to add product"
        description="Scan a manufacturer's barcode with a USB scanner, or type it and press Enter. If it's new, you'll fill in the product details next; if it already exists, you'll edit that product."
        tip="" />
      <CategoriesModal open={catsOpen} onClose={() => setCatsOpen(false)} products={products} />
    </>
  );
};

// Lists every category with how many products currently use it, and lets
// you delete the empty ones. A category still holding products can't be
// deleted here (or server-side, even if this check somehow gets bypassed)
// — move those products to a different category first via Edit Product,
// since there's no bulk-reassign UI.
const CategoriesModal = ({ open, onClose, products }) => {
  const { categories: liveCategories, removeCategory } = useData();
  const { toast } = useToast();
  const [busyId, setBusyId] = useState(null);
  const counts = new Map();
  (products || []).forEach(p => counts.set(p.category, (counts.get(p.category) || 0) + 1));

  const remove = async (cat) => {
    const inUse = counts.get(cat.id) || 0;
    if (inUse > 0) {
      toast(`"${cat.label}" still has ${inUse} product${inUse === 1 ? '' : 's'} in it — move them to another category first`, 'error');
      return;
    }
    if (!window.confirm(`Delete category "${cat.label}"?`)) return;
    setBusyId(cat.id);
    try {
      await api.deleteCategory(cat.id);
      removeCategory(cat.id);
      toast(`"${cat.label}" deleted`);
    } catch (e) {
      toast(e.message || 'Could not delete category', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Categories">
      <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
        {(liveCategories || []).length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-6">No categories yet.</p>
        ) : (liveCategories || []).map(cat => {
          const inUse = counts.get(cat.id) || 0;
          return (
            <div key={cat.id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-stone-200 bg-white">
              <div className="min-w-0">
                <div className="text-sm font-medium text-stone-900 truncate">{cat.label}</div>
                <div className="text-[11px] text-stone-400">{inUse} product{inUse === 1 ? '' : 's'}</div>
              </div>
              <button onClick={() => remove(cat)} disabled={busyId === cat.id || inUse > 0}
                title={inUse > 0 ? 'Move its products to another category first' : 'Delete category'}
                className="p-2 text-stone-400 hover:text-rose-600 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0">
                <Trash2 size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </Modal>
  );
};

const SupplierLedgerModal = ({ supplier, open, onClose }) => {
  const { toast } = useToast();
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState(null); // null | 'credit' | 'payment'
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  const load = async () => {
    if (!supplier?.id) return;
    setLoading(true);
    try { setStatement(await api.getSupplierStatement(supplier.id)); } catch {}
    setLoading(false);
  };

  useEffect(() => {
    if (open) { load(); setMode(null); setAmount(''); setNote(''); setDate(new Date().toISOString().slice(0, 10)); }
  }, [open, supplier?.id]);

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast('Enter a valid amount', 'error'); return; }
    try {
      if (mode === 'credit') {
        await api.addSupplierCredit(supplier.id, { amount: amt, date, note });
        toast('Credit recorded');
      } else {
        await api.addSupplierPayment(supplier.id, { amount: amt, date, note });
        toast('Payment recorded');
      }
      setMode(null); setAmount(''); setNote('');
      load();
    } catch (e) { toast(e.message || 'Failed', 'error'); }
  };

  if (!open) return null;
  const { totalCredit = 0, totalPaid = 0, outstanding = 0, credits = [], payments = [] } = statement || {};
  const txns = [
    ...credits.map(c => ({ ...c, type: 'credit' })),
    ...payments.map(p => ({ ...p, type: 'payment' })),
  ].sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));

  return (
    <Modal open={open} onClose={onClose} title={`${supplier?.name} — Credit Ledger`}>
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-stone-50 rounded-xl p-3 text-center">
          <div className="text-[10px] text-stone-500 uppercase tracking-wider mb-1">Total Credit</div>
          <div className="text-sm font-semibold text-stone-900">{fmt(totalCredit)}</div>
        </div>
        <div className="bg-rose-50 rounded-xl p-3 text-center">
          <div className="text-[10px] text-stone-500 uppercase tracking-wider mb-1">Paid</div>
          <div className="text-sm font-semibold text-rose-700">{fmt(totalPaid)}</div>
        </div>
        <div className={`rounded-xl p-3 text-center ${outstanding > 0 ? 'bg-rose-50' : 'bg-stone-50'}`}>
          <div className="text-[10px] text-stone-500 uppercase tracking-wider mb-1">Outstanding</div>
          <div className={`text-sm font-semibold ${outstanding > 0 ? 'text-rose-700' : 'text-stone-500'}`}>
            {outstanding > 0 ? fmt(outstanding) : '—'}
          </div>
        </div>
      </div>

      {!mode && (
        <div className="flex gap-2 mb-4">
          <button onClick={() => setMode('credit')}
            className="flex-1 py-2 bg-rose-50 text-rose-700 rounded-lg text-sm font-medium hover:bg-rose-100 flex items-center justify-center gap-1.5">
            <Plus size={14} /> Add Credit
          </button>
          <button onClick={() => setMode('payment')} disabled={outstanding <= 0}
            className="flex-1 py-2 bg-rose-50 text-rose-700 rounded-lg text-sm font-medium hover:bg-rose-100 flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
            <Banknote size={14} /> Record Payment
          </button>
        </div>
      )}

      {mode && (
        <div className="mb-4 bg-stone-50 rounded-xl p-4 space-y-3">
          <div className="text-sm font-medium text-stone-900">
            {mode === 'credit' ? 'New Credit Entry' : 'Record Payment'}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-stone-500 mb-1 block">Amount (FCFA)</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0"
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-rose-600 bg-white" />
            </div>
            <div>
              <label className="text-xs text-stone-500 mb-1 block">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-rose-600 bg-white" />
            </div>
          </div>
          <div>
            <label className="text-xs text-stone-500 mb-1 block">Note (optional)</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. new stock delivery"
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-rose-600 bg-white" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setMode(null); setAmount(''); setNote(''); }}
              className="flex-1 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-lg transition-colors">Cancel</button>
            <button onClick={submit}
              className="flex-1 py-2 bg-rose-900 text-white rounded-lg text-sm font-medium hover:bg-rose-800">Save</button>
          </div>
        </div>
      )}

      <div className="space-y-1.5 max-h-60 overflow-y-auto">
        {loading ? (
          <div className="text-center text-sm text-stone-400 py-6">Loading…</div>
        ) : txns.length === 0 ? (
          <div className="text-center text-sm text-stone-400 py-6">No transactions yet</div>
        ) : txns.map(tx => (
          <div key={`${tx.type}-${tx.id}`} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-stone-50">
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${tx.type === 'credit' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {tx.type === 'credit' ? 'CREDIT' : 'PAID'}
                </span>
                <span className="text-xs text-stone-500">{tx.date}</span>
              </div>
              {tx.note && <div className="text-xs text-stone-400 mt-0.5">{tx.note}</div>}
            </div>
            <div className={`text-sm font-semibold ${tx.type === 'credit' ? 'text-rose-700' : 'text-emerald-700'}`}>
              {tx.type === 'credit' ? '+' : '−'}{fmt(tx.amount)}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
};

const SuppliersPanel = () => {
  const { t } = useT();
  const { suppliers: liveSuppliers, online } = useData();
  const SUPP = online ? (liveSuppliers || []) : (liveSuppliers?.length ? liveSuppliers : SUPPLIERS);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [ledgerSupplier, setLedgerSupplier] = useState(null);
  const [balances, setBalances] = useState({});
  useEffect(() => {
    api.getSupplierBalances().then(list => {
      const map = {};
      list.forEach(b => { map[b.supplierId] = b; });
      setBalances(map);
    }).catch(() => {});
  }, [ledgerSupplier]); // refresh after closing ledger

  const filtered = SUPP.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.contact || '').toLowerCase().includes(search.toLowerCase())
  );
  const active = SUPP.filter(s => s.status === 'active').length;
  const totalProducts = SUPP.reduce((sum, s) => sum + s.productsCount, 0);
  const orderedDates = SUPP.filter(s => s.lastOrder).map(s => (Date.now() - new Date(s.lastOrder).getTime()) / 86400000);
  const avgDaysSinceOrder = orderedDates.length ? Math.round((orderedDates.reduce((a, b) => a + b, 0) / orderedDates.length) * 10) / 10 : null;

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KpiCard label={t('suppliers')} value={SUPP.length.toString()} icon={Truck} accent="bg-rose-50 text-rose-700" />
        <KpiCard label={t('active')} value={active.toString()} icon={CheckCircle2} accent="bg-sky-50 text-sky-700" />
        <KpiCard label={t('products_count')} value={totalProducts.toString()} icon={Package} accent="bg-amber-50 text-amber-700" />
        <KpiCard label="Avg. days since order" value={avgDaysSinceOrder != null ? `${avgDaysSinceOrder} days` : '—'} icon={Clock} accent="bg-rose-50 text-rose-700" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
        {filtered.slice(0, 6).map(s => (
          <div key={s.id} className="bg-white rounded-2xl p-5 border border-stone-200/80 hover:shadow-md hover:shadow-stone-900/5 transition-all">
            <div className="flex items-start justify-between mb-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-100 to-rose-50 flex items-center justify-center">
                <Building2 size={18} className="text-rose-800" />
              </div>
              <span className={`text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-md ${
                s.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'
              }`}>
                {t(s.status)}
              </span>
            </div>
            <h3 className="font-serif text-base text-stone-900 mb-1" style={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}>{s.name}</h3>
            <div className="text-xs text-stone-500 mb-3">{s.category}</div>
            <div className="space-y-1 text-xs text-stone-600 mb-3">
              <div className="flex items-center gap-2"><UserCircle2 size={12} className="text-stone-400" /> {s.contact}</div>
              <div className="flex items-center gap-2"><Phone size={12} className="text-stone-400" /> {s.phone}</div>
              <div className="flex items-center gap-2 truncate"><Mail size={12} className="text-stone-400" /> {s.email}</div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-stone-100">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-stone-500">{t('products_count')}</div>
                <div className="text-sm font-semibold text-stone-900">{s.productsCount}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-stone-500">{t('last_order')}</div>
                <div className="text-sm font-medium text-stone-900">{s.lastOrder}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-stone-200/80 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-full sm:min-w-0 sm:max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search suppliers..."
              className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-rose-600" />
          </div>
          <button onClick={() => { setEditing(null); setModalOpen(true); }} className="sm:ml-auto flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-rose-900 text-white rounded-lg hover:bg-rose-800">
            <Plus size={14} /> {t('add_supplier')}
          </button>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-widest text-stone-500 font-medium border-b border-stone-200/80">
              <th className="px-5 py-3">{t('supplier')}</th>
              <th className="px-3 py-3">{t('contact')}</th>
              <th className="px-3 py-3">{t('category')}</th>
              <th className="px-3 py-3">{t('products_count')}</th>
              <th className="px-3 py-3">{t('last_order')}</th>
              <th className="px-3 py-3">{t('status')}</th>
              <th className="px-3 py-3">Outstanding</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => {
              const bal = balances[s.id];
              const outstanding = bal ? bal.outstanding : 0;
              return (
              <tr key={s.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                <td className="px-5 py-3">
                  <div className="text-sm font-medium text-stone-900">{s.name}</div>
                  <div className="text-xs text-stone-500">{s.email}</div>
                </td>
                <td className="px-3 py-3">
                  <div className="text-sm text-stone-900">{s.contact}</div>
                  <div className="text-xs text-stone-500">{s.phone}</div>
                </td>
                <td className="px-3 py-3 text-sm text-stone-700">{s.category}</td>
                <td className="px-3 py-3 text-sm font-medium text-stone-900">{s.productsCount}</td>
                <td className="px-3 py-3 text-sm text-stone-700">{s.lastOrder}</td>
                <td className="px-3 py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-md ${
                    s.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.status === 'active' ? 'bg-emerald-500' : 'bg-stone-400'}`} />
                    {t(s.status)}
                  </span>
                </td>
                <td className="px-3 py-3">
                  {outstanding > 0 ? (
                    <span className="text-sm font-semibold text-rose-700">{fmt(outstanding)}</span>
                  ) : (
                    <span className="text-xs text-stone-400">—</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right flex items-center justify-end gap-2">
                  <button onClick={() => setLedgerSupplier(s)}
                    className="text-xs text-rose-700 hover:text-rose-900 font-medium">Ledger</button>
                  <button onClick={() => { setEditing(s); setModalOpen(true); }} className="text-xs text-stone-500 hover:text-stone-900">{t('edit')}</button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
      <SupplierForm open={modalOpen} onClose={() => setModalOpen(false)} initial={editing} />
      <SupplierLedgerModal supplier={ledgerSupplier} open={!!ledgerSupplier} onClose={() => setLedgerSupplier(null)} />
    </>
  );
};

const PurchaseOrdersPanel = () => {
  const { t } = useT();
  const { purchaseOrders: livePOs, online, upsertPO } = useData();
  const { toast } = useToast();
  const POS = online ? (livePOs || []) : (livePOs?.length ? livePOs : PURCHASE_ORDERS);
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [payTarget, setPayTarget] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const filtered = statusFilter === 'all' ? POS : POS.filter(po => po.status === statusFilter);
  const today = new Date().toISOString().slice(0, 10);
  const outstandingOf = (po) => po.outstanding ?? (po.total - (po.amountPaid || 0));
  const isOverdue = (po) => po.dueDate && po.dueDate < today && outstandingOf(po) > 0;

  const counts = {
    draft: POS.filter(p => p.status === 'draft').length,
    sent: POS.filter(p => p.status === 'sent').length,
    'in-transit': POS.filter(p => p.status === 'in-transit').length,
    received: POS.filter(p => p.status === 'received').length,
  };
  const totalValue = POS.filter(p => p.status !== 'cancelled').reduce((s, p) => s + p.total, 0);
  const pending = POS.filter(p => ['sent', 'in-transit'].includes(p.status)).reduce((s, p) => s + p.total, 0);
  const totalPayable = POS.filter(p => p.status !== 'cancelled').reduce((s, p) => s + outstandingOf(p), 0);

  // Requires connectivity — see note on ProductForm.save for why status
  // changes aren't queued offline.
  const advance = async (po, next) => {
    try {
      const saved = await api.updatePurchaseOrder(po.id, { status: next });
      upsertPO(saved);
      toast(`${po.id} → ${next}`);
    } catch (e) {
      toast(!e.status ? "Can't update while offline — try again once connected" : e.message, 'error');
    }
  };
  const submitPayment = async () => {
    const amt = Number(payAmount);
    if (!amt || amt <= 0) { toast('Enter a payment amount', 'error'); return; }
    try {
      const saved = await api.recordPOPayment(payTarget.id, { amount: amt, method: 'cash' });
      upsertPO(saved);
      toast(`Payment of ${fmt(amt)} recorded for ${payTarget.id}`);
      setPayTarget(null); setPayAmount('');
    } catch (e) {
      toast(!e.status ? "Can't record a payment while offline — try again once connected" : e.message, 'error');
    }
  };
  const exportPOs = () => {
    const rows = [['PO Number', 'Supplier', 'Date', 'Due date', 'Items', 'Total', 'Paid', 'Outstanding', 'Status']];
    filtered.forEach(p => rows.push([p.id, p.supplier, p.date, p.dueDate || '', p.items, p.total, p.amountPaid || 0, outstandingOf(p), p.status]));
    downloadCsv(`purchase-orders-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  const statusFilters = [
    { id: 'all', label: t('all'), count: POS.length },
    { id: 'draft', label: t('draft'), count: counts.draft },
    { id: 'sent', label: t('sent'), count: counts.sent },
    { id: 'in-transit', label: t('in_transit'), count: counts['in-transit'] },
    { id: 'received', label: t('received'), count: counts.received },
  ];

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
        <KpiCard label="Open POs" value={(counts.draft + counts.sent + counts['in-transit']).toString()} icon={ClipboardList} accent="bg-rose-50 text-rose-700" />
        <KpiCard label="Pending delivery" value={fmtShort(pending) + ' FCFA'} icon={Truck} accent="bg-amber-50 text-amber-700" />
        <KpiCard label="Received this month" value={counts.received.toString()} icon={CheckCircle2} accent="bg-sky-50 text-sky-700" />
        <KpiCard label="Total YTD" value={fmtShort(totalValue) + ' FCFA'} icon={Wallet} accent="bg-rose-50 text-rose-700" />
        <KpiCard label="Total payable" value={fmtShort(totalPayable) + ' FCFA'} icon={Banknote} accent="bg-orange-50 text-orange-700" />
      </div>

      <div className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden">
        <div className="p-5 border-b border-stone-200/80 flex items-center gap-3 flex-wrap">
          <div className="flex gap-1 flex-wrap">
            {statusFilters.map(f => (
              <button key={f.id} onClick={() => setStatusFilter(f.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  statusFilter === f.id ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100 border border-stone-200'
                }`}>
                {f.label}
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${
                  statusFilter === f.id ? 'bg-white/20' : 'bg-stone-100'
                }`}>{f.count}</span>
              </button>
            ))}
          </div>
          <button onClick={exportPOs} className="ml-auto flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-lg">
            <Download size={14} /> {t('export')}
          </button>
          <button onClick={() => setCreateOpen(true)} className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-rose-900 text-white rounded-lg hover:bg-rose-800">
            <Plus size={14} /> {t('create_po')}
          </button>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-widest text-stone-500 font-medium border-b border-stone-200/80">
              <th className="px-5 py-3">{t('po_number')}</th>
              <th className="px-3 py-3">{t('supplier')}</th>
              <th className="px-3 py-3">{t('order_date')}</th>
              <th className="px-3 py-3">{t('items_label')}</th>
              <th className="px-3 py-3">{t('total_amount')}</th>
              <th className="px-3 py-3">Outstanding</th>
              <th className="px-3 py-3">{t('status')}</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(po => {
              const s = PO_STATUS[po.status];
              const labelKey = { 'in-transit': 'in_transit', draft: 'draft', sent: 'sent', received: 'received', cancelled: 'cancelled' }[po.status];
              const outstanding = outstandingOf(po);
              const overdue = isOverdue(po);
              return (
                <tr key={po.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                  <td className="px-5 py-3 text-sm font-mono font-medium text-stone-900">{po.id}</td>
                  <td className="px-3 py-3 text-sm text-stone-700">{po.supplier}</td>
                  <td className="px-3 py-3 text-sm text-stone-600">{po.date}</td>
                  <td className="px-3 py-3 text-sm text-stone-700">{po.items}</td>
                  <td className="px-3 py-3 text-sm font-medium text-stone-900">{fmt(po.total)}</td>
                  <td className="px-3 py-3">
                    {po.status === 'cancelled' ? (
                      <span className="text-xs text-stone-400">—</span>
                    ) : outstanding <= 0 ? (
                      <span className="text-xs text-emerald-700 font-medium">Paid in full</span>
                    ) : (
                      <div className="text-xs">
                        <span className={`font-medium ${overdue ? 'text-rose-700' : 'text-amber-700'}`}>{fmt(outstanding)}</span>
                        {po.dueDate && <span className={`block ${overdue ? 'text-rose-500' : 'text-stone-400'}`}>{overdue ? 'Overdue · ' : 'Due '}{po.dueDate}</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-medium rounded-md ${s.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{t(labelKey)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    {po.status === 'draft' && (
                      <button onClick={() => advance(po, 'sent')} className="text-xs text-rose-700 hover:text-rose-900 font-medium inline-flex items-center gap-1">
                        <Send size={11} /> {t('sent')}
                      </button>
                    )}
                    {po.status === 'sent' && (
                      <button onClick={() => advance(po, 'in-transit')} className="text-xs text-amber-700 hover:text-amber-900 font-medium">{t('in_transit')}</button>
                    )}
                    {po.status === 'in-transit' && (
                      <button onClick={() => advance(po, 'received')} className="text-xs text-rose-700 hover:text-rose-900 font-medium inline-flex items-center gap-1">
                        <FileCheck size={11} /> {t('received')}
                      </button>
                    )}
                    {po.status !== 'cancelled' && outstanding > 0 && (
                      <button onClick={() => { setPayTarget(po); setPayAmount(''); }} className="text-xs text-stone-600 hover:text-stone-900 font-medium ml-3">Record payment</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
      <POForm open={createOpen} onClose={() => setCreateOpen(false)} />

      <Modal open={!!payTarget} onClose={() => setPayTarget(null)} title={`Record payment — ${payTarget?.id || ''}`}
        footer={<>
          <button onClick={() => setPayTarget(null)} className="px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 rounded-lg">Cancel</button>
          <button onClick={submitPayment} className="px-4 py-2 bg-rose-900 text-white rounded-lg text-sm font-medium hover:bg-rose-800">Record payment</button>
        </>}>
        {payTarget && (
          <>
            <p className="text-sm text-stone-600 mb-3">
              {payTarget.supplier} · Outstanding: <span className="font-medium text-stone-900">{fmt(outstandingOf(payTarget))}</span> of {fmt(payTarget.total)}
            </p>
            <Field label="Payment amount (FCFA)">
              <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="0" />
            </Field>
          </>
        )}
      </Modal>
    </>
  );
};

const StockMovementsPanel = () => {
  const { t } = useT();
  const { stockMovements: liveMoves, online } = useData();
  const MOVES = online ? (liveMoves || []) : (liveMoves?.length ? liveMoves : STOCK_MOVEMENTS);
  const [typeFilter, setTypeFilter] = useState('all');
  const filtered = typeFilter === 'all' ? MOVES : MOVES.filter(m => m.type === typeFilter);

  const ins = MOVES.filter(m => m.type === 'in').length;
  const outs = MOVES.filter(m => m.type === 'out').length;
  const adjusts = MOVES.filter(m => m.type === 'adjust').length;

  const exportMoves = () => {
    const rows = [['Type', 'Product', 'Qty', 'Source', 'User', 'Date']];
    filtered.forEach(m => rows.push([m.type, m.productName, m.qty, m.source, m.user, m.date]));
    downloadCsv(`stock-movements-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KpiCard label={t('stock_in')} value={ins.toString()} icon={ArrowDownLeft} accent="bg-rose-50 text-rose-700" />
        <KpiCard label={t('stock_out')} value={outs.toString()} icon={ArrowUpLeft} accent="bg-amber-50 text-amber-700" />
        <KpiCard label={t('adjustment')} value={adjusts.toString()} icon={RefreshCw} accent="bg-rose-50 text-rose-700" />
        <KpiCard label="Today's movements" value={MOVES.length.toString()} icon={Package} accent="bg-sky-50 text-sky-700" />
      </div>

      <div className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-stone-200/80 flex items-center gap-3">
          <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {[
              { id: 'all', label: t('all') },
              { id: 'in', label: t('stock_in') },
              { id: 'out', label: t('stock_out') },
              { id: 'adjust', label: t('adjustment') },
            ].map(f => (
              <button key={f.id} onClick={() => setTypeFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                  typeFilter === f.id ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100 border border-stone-200'
                }`}>
                {f.label}
              </button>
            ))}
          </div>
          <button onClick={exportMoves} className="ml-auto flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-lg">
            <Download size={14} /> {t('export')}
          </button>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-widest text-stone-500 font-medium border-b border-stone-200/80">
              <th className="px-5 py-3">{t('type')}</th>
              <th className="px-3 py-3">{t('product')}</th>
              <th className="px-3 py-3">{t('quantity')}</th>
              <th className="px-3 py-3">{t('source')}</th>
              <th className="px-3 py-3">{t('user')}</th>
              <th className="px-5 py-3">{t('date_time')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(m => {
              const styles = {
                in: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: ArrowDownLeft, label: t('stock_in') },
                out: { bg: 'bg-amber-50', text: 'text-amber-700', icon: ArrowUpLeft, label: t('stock_out') },
                adjust: { bg: 'bg-rose-50', text: 'text-rose-700', icon: RefreshCw, label: t('adjustment') },
              }[m.type];
              const Icon = styles.icon;
              return (
                <tr key={m.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 ${styles.bg} ${styles.text} text-[11px] font-medium rounded-md`}>
                      <Icon size={11} />{styles.label}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-sm font-medium text-stone-900">{m.productName}</td>
                  <td className="px-3 py-3">
                    <span className={`text-sm font-semibold ${m.type === 'in' ? 'text-emerald-700' : m.type === 'out' ? 'text-amber-700' : 'text-rose-700'}`}>
                      {m.type === 'in' ? '+' : m.type === 'out' ? '−' : (m.qty >= 0 ? '+' : '−')}{Math.abs(m.qty)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs font-mono text-stone-600">{m.source}</td>
                  <td className="px-3 py-3 text-sm text-stone-700">{m.user}</td>
                  <td className="px-5 py-3 text-xs text-stone-500">{m.date}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </>
  );
};

// ============ CUSTOMERS ============
const CustomersView = () => {
  const { t } = useT();
  const { can } = useRole();
  const { customers: liveCustomers, online } = useData();
  const list = online ? (liveCustomers || []) : (liveCustomers?.length ? liveCustomers : CUSTOMERS);
  const [detail, setDetail] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [showPromo, setShowPromo] = useState(false);
  const allSelected = list.length > 0 && list.every(c => selected.has(c.id));
  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(list.map(c => c.id)));
  const exportCustomers = () => {
    const rows = [['Name', 'Phone', 'Tier', 'Visits', 'Lifetime value']];
    list.forEach(c => rows.push([c.name, c.phone, c.tier, c.visits, c.spent]));
    downloadCsv(`customers-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };
  const totalCustomers = list.length;
  const loyaltyMembers = list.filter(c => c.tier && c.tier !== 'Bronze').length;
  const totalVisits = list.reduce((sum, c) => sum + (c.visits || 0), 0);
  const totalSpent = list.reduce((sum, c) => sum + (c.spent || 0), 0);
  const avgVisitValue = totalVisits ? Math.round(totalSpent / totalVisits) : 0;
  const returning = list.filter(c => (c.visits || 0) > 1).length;
  const retentionPct = totalCustomers ? Math.round((returning / totalCustomers) * 100) : 0;
  const tierCounts = ['Platinum', 'Gold', 'Silver'].map(tier => {
    const members = list.filter(c => c.tier === tier);
    const revenue = members.reduce((sum, c) => sum + (c.spent || 0), 0);
    return {
      tier, count: members.length,
      pctOfTotal: totalCustomers ? Math.round((members.length / totalCustomers) * 100) : 0,
      pctOfRevenue: totalSpent ? Math.round((revenue / totalSpent) * 100) : 0,
    };
  });
  return (
    <div className="flex-1 overflow-y-auto bg-stone-50/30 p-7">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KpiCard label={t('total_customers')} value={totalCustomers.toLocaleString()} icon={Users} accent="bg-rose-50 text-rose-700" />
        <KpiCard label={t('loyalty_members')} value={loyaltyMembers.toLocaleString()} icon={Star} accent="bg-amber-50 text-amber-700" />
        <KpiCard label={t('avg_visit')} value={`${fmt(avgVisitValue)}`} icon={Receipt} accent="bg-rose-50 text-rose-700" />
        <KpiCard label={t('retention')} value={`${retentionPct}%`} icon={TrendingUp} accent="bg-sky-50 text-sky-700" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        {[
          { ...tierCounts[0], gradient: 'from-stone-700 to-stone-900' },
          { ...tierCounts[1], gradient: 'from-amber-400 to-amber-600' },
          { ...tierCounts[2], gradient: 'from-stone-300 to-stone-500' },
        ].map(tt => (
          <div key={tt.tier} className="bg-white rounded-2xl p-5 border border-stone-200/80 relative overflow-hidden">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tt.gradient} flex items-center justify-center mb-3`}>
              <Award size={20} className="text-white" />
            </div>
            <div className="text-[10px] uppercase tracking-widest text-stone-500 font-medium mb-1">{tt.tier} {t('tier')}</div>
            <div className="font-serif text-2xl text-stone-900 mb-1" style={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}>{tt.count} {t('loyalty_members').toLowerCase()}</div>
            <div className="text-xs text-stone-500">{tt.pctOfTotal}% of total · {tt.pctOfRevenue}% of revenue</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden">
        <div className="p-5 border-b border-stone-200/80 flex items-center justify-between">
          <div>
            <h3 className="font-serif text-lg text-stone-900" style={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}>{t('recent_customers')}</h3>
            <p className="text-xs text-stone-500 mt-0.5">{t('top_spenders')}</p>
          </div>
          <div className="flex items-center gap-3">
            {!can.readOnly && selected.size > 0 && (
              <button onClick={() => setShowPromo(true)}
                className="text-xs px-3 py-1.5 bg-rose-900 text-white rounded-lg font-medium hover:bg-rose-800 flex items-center gap-1.5">
                <MessageCircle size={13} /> Notify via WhatsApp ({selected.size})
              </button>
            )}
            <button onClick={exportCustomers} className="text-xs text-rose-700 font-medium flex items-center gap-1">{t('view_all')} <ChevronRight size={13} /></button>
          </div>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-widest text-stone-500 font-medium border-b border-stone-200/80">
              <th className="px-5 py-3 w-8">
                {!can.readOnly && (
                  <input type="checkbox" checked={allSelected} onChange={toggleAll}
                    className="h-4 w-4 rounded border-stone-300 text-rose-600 focus:ring-rose-500" />
                )}
              </th>
              <th className="px-3 py-3">{t('customer')}</th>
              <th className="px-3 py-3">{t('tier')}</th>
              <th className="px-3 py-3">{t('visits')}</th>
              <th className="px-3 py-3">{t('lifetime_value')}</th>
              <th className="px-3 py-3">Points</th>
              <th className="px-3 py-3">Credit</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {list.map(c => (
              <tr key={c.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                <td className="px-5 py-3">
                  {!can.readOnly && (
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)}
                      className="h-4 w-4 rounded border-stone-300 text-rose-600 focus:ring-rose-500" />
                  )}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold ${TIER_COLOR[c.tier]}`}>
                      {c.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-stone-900">{c.name}</div>
                      <div className="text-xs text-stone-500">{c.phone}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-medium ${TIER_COLOR[c.tier]}`}>{c.tier}</span>
                </td>
                <td className="px-3 py-3 text-sm text-stone-700">{c.visits}</td>
                <td className="px-3 py-3 text-sm font-medium text-stone-900">{fmt(c.spent)}</td>
                <td className="px-3 py-3 text-sm text-violet-700">{c.points || 0}</td>
                <td className="px-3 py-3 text-sm text-teal-700">{c.creditBalance ? fmt(c.creditBalance) : '—'}</td>
                <td className="px-5 py-3 text-right">
                  <button onClick={() => setDetail(c)} className="text-xs text-stone-500 hover:text-stone-900">View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name}>
        {detail && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold ${TIER_COLOR[detail.tier]}`}>
                {detail.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <div className="font-medium text-stone-900">{detail.name}</div>
                <div className="text-xs text-stone-500">{detail.phone}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="bg-stone-50 rounded-lg p-3"><div className="text-xs text-stone-500">{t('tier')}</div><div className="font-medium">{detail.tier}</div></div>
              <div className="bg-stone-50 rounded-lg p-3"><div className="text-xs text-stone-500">{t('visits')}</div><div className="font-medium">{detail.visits}</div></div>
              <div className="bg-stone-50 rounded-lg p-3"><div className="text-xs text-stone-500">{t('lifetime_value')}</div><div className="font-medium">{fmt(detail.spent)}</div></div>
              <div className="bg-violet-50 rounded-lg p-3"><div className="text-xs text-violet-600">Points</div><div className="font-medium text-violet-900">{detail.points || 0} ({fmt((detail.points || 0) * FCFA_PER_POINT)})</div></div>
              <div className="bg-teal-50 rounded-lg p-3 col-span-2"><div className="text-xs text-teal-600">Store credit</div><div className="font-medium text-teal-900">{fmt(detail.creditBalance || 0)}</div></div>
            </div>
          </div>
        )}
      </Modal>

      <WhatsAppPromoModal open={showPromo} onClose={() => setShowPromo(false)} customers={list.filter(c => selected.has(c.id))} />
    </div>
  );
};

// ============ REPORTS ============
const SaleEditModal = ({ orderId, open, onClose, onSaved }) => {
  const { toast } = useToast();
  const { products: liveProducts } = useData();
  const products = liveProducts || [];
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [method, setMethod] = useState('cash');
  const [saving, setSaving] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    if (!open || !orderId) return;
    setOrder(null); setShowAdd(false); setAddSearch('');
    api.getOrder(orderId).then(o => {
      setOrder(o);
      setItems(o.items.map(i => ({ ...i })));
      setDiscount(o.discount || 0);
      setMethod(o.method || 'cash');
    }).catch(e => toast(e.message || 'Failed to load order', 'error'));
  }, [open, orderId]);

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const total = subtotal - Number(discount);

  const setQty = (idx, val) => {
    const q = parseInt(val);
    if (isNaN(q) || q < 1) return;
    setItems(it => it.map((x, i) => i === idx ? { ...x, qty: q } : x));
  };
  const setPrice = (idx, val) => {
    const p = parseFloat(val);
    if (isNaN(p) || p < 0) return;
    setItems(it => it.map((x, i) => i === idx ? { ...x, price: p } : x));
  };
  const removeItem = (idx) => setItems(it => it.filter((_, i) => i !== idx));
  const addProduct = (p) => {
    const existing = items.findIndex(i => i.productId === p.id);
    if (existing >= 0) {
      setItems(it => it.map((x, i) => i === existing ? { ...x, qty: x.qty + 1 } : x));
    } else {
      setItems(it => [...it, { productId: p.id, name: p.name, sku: p.sku || '', price: p.price, cost: p.cost || 0, qty: 1 }]);
    }
    setAddSearch(''); setShowAdd(false);
  };

  const save = async () => {
    if (items.length === 0) { toast('Sale must have at least one item', 'error'); return; }
    setSaving(true);
    try {
      await api.updateOrder(orderId, { items, discount: Number(discount), method });
      toast('Sale updated');
      onSaved?.();
      onClose();
    } catch (e) { toast(e.message || 'Failed to save', 'error'); }
    setSaving(false);
  };

  const matchingProducts = addSearch.length > 1
    ? products.filter(p => p.name.toLowerCase().includes(addSearch.toLowerCase()) || (p.sku || '').toLowerCase().includes(addSearch.toLowerCase())).slice(0, 6)
    : [];

  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title={order ? `Edit Sale · ${order.invoiceNo}` : 'Edit Sale'}>
      {!order ? (
        <div className="text-center text-sm text-stone-400 py-10">Loading…</div>
      ) : (<>
        <div className="text-xs text-stone-500 mb-4">
          {new Date(order.createdAt).toLocaleString()} · Cashier: {order.cashier || '—'}
        </div>

        {/* Items table */}
        <div className="space-y-1.5 mb-4">
          {items.map((it, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-stone-50 rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-stone-900 truncate">{it.name}</div>
                <div className="text-xs text-stone-400">{it.sku}</div>
              </div>
              <div className="flex items-center gap-1">
                <label className="text-[10px] text-stone-400">Qty</label>
                <input type="number" min="1" value={it.qty} onChange={e => setQty(idx, e.target.value)}
                  className="w-14 px-1.5 py-1 text-sm border border-stone-200 rounded text-center focus:outline-none focus:border-rose-500 bg-white" />
              </div>
              <div className="flex items-center gap-1">
                <label className="text-[10px] text-stone-400">Price</label>
                <input type="number" min="0" value={it.price} onChange={e => setPrice(idx, e.target.value)}
                  className="w-24 px-1.5 py-1 text-sm border border-stone-200 rounded text-right focus:outline-none focus:border-rose-500 bg-white" />
              </div>
              <div className="w-24 text-right text-sm font-medium text-stone-900">{fmt(it.price * it.qty)}</div>
              <button onClick={() => removeItem(idx)} className="text-stone-300 hover:text-rose-500 flex-shrink-0">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* Add item */}
        {!showAdd ? (
          <button onClick={() => setShowAdd(true)}
            className="w-full py-2 text-xs text-stone-500 border border-dashed border-stone-300 rounded-lg hover:border-rose-400 hover:text-rose-700 flex items-center justify-center gap-1.5 mb-4">
            <Plus size={13} /> Add item
          </button>
        ) : (
          <div className="mb-4 relative">
            <input autoFocus value={addSearch} onChange={e => setAddSearch(e.target.value)}
              placeholder="Search product to add…"
              className="w-full px-3 py-2 border border-rose-400 rounded-lg text-sm focus:outline-none bg-white" />
            {matchingProducts.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-stone-200 rounded-lg shadow-lg z-50 overflow-hidden">
                {matchingProducts.map(p => (
                  <button key={p.id} onClick={() => addProduct(p)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-stone-50 flex items-center justify-between">
                    <span>{p.name}</span>
                    <span className="text-xs text-stone-500">{fmt(p.price)}</span>
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => { setShowAdd(false); setAddSearch(''); }}
              className="absolute right-2 top-2 text-stone-400 hover:text-stone-700"><X size={14} /></button>
          </div>
        )}

        {/* Totals */}
        <div className="border-t border-stone-100 pt-3 mb-4 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-stone-500">Subtotal</span>
            <span className="font-medium">{fmt(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-500">Discount</span>
            <input type="number" min="0" value={discount} onChange={e => setDiscount(e.target.value)}
              className="w-28 px-2 py-0.5 text-sm border border-stone-200 rounded text-right focus:outline-none focus:border-rose-500 bg-white" />
          </div>
          <div className="flex justify-between text-sm font-semibold text-stone-900">
            <span>Total</span><span>{fmt(total)}</span>
          </div>
        </div>

        {/* Payment method */}
        <div className="flex gap-2 mb-5">
          {[['cash','Cash'],['mobile','Mobile Money'],['card','Card']].map(([v,l]) => (
            <button key={v} onClick={() => setMethod(v)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg border ${method === v ? 'bg-rose-900 text-white border-rose-900' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
              {l}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-lg">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2 bg-rose-900 text-white rounded-lg text-sm font-medium hover:bg-rose-800 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </>)}
    </Modal>
  );
};

const ReportsView = () => {
  const { t } = useT();
  const { can } = useRole();
  const { online, products: liveProducts, customers, purchaseOrders } = useData();
  const { toast } = useToast();
  const products = online ? (liveProducts || []) : (liveProducts?.length ? liveProducts : PRODUCTS);

  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [editOrderId, setEditOrderId] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [ordersLoaded, setOrdersLoaded] = useState(false);

  const loadOrders = () => api.getOrders().then(setRecentOrders).catch(() => {}).finally(() => setOrdersLoaded(true));
  const [range, setRange] = useState(null);
  const [zData, setZData] = useState(null);
  const [pnl, setPnl] = useState(null);
  const [pnlTrend, setPnlTrend] = useState([]);
  const [weeklySales, setWeeklySales] = useState([]);
  const [loading, setLoading] = useState(false);

  const methodLabel = (m) => ({ cash: 'Cash', mobile: 'Mobile money', card: 'Card' }[m] || m || '—');

  // Pull the date-range accounting figures (and P&L for the same range) from the backend.
  const runRange = async () => {
    if (!online) { toast('Connect to the backend to run accounting reports', 'error'); return; }
    setLoading(true);
    try {
      const [r, p] = await Promise.all([api.rangeReport(from, to), api.pnlReport(from, to)]);
      setRange(r);
      setPnl(p);
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  };

  // Today's Z-report (close-out).
  const runZ = async () => {
    if (!online) { toast('Connect to the backend to run the Z-report', 'error'); return; }
    try { setZData(await api.zReport(today)); }
    catch (e) { toast(e.message, 'error'); }
  };

  useEffect(() => {
    if (!online) return;
    runRange(); runZ(); loadOrders();
    api.pnlTrend(6).then(setPnlTrend).catch(() => {});
    api.salesReport(7).then(r => setWeeklySales((r.daily || []).map(d => ({
      ...d, label: new Date(d.day).toLocaleDateString(undefined, { weekday: 'short' }),
    })))).catch(() => {});
  }, [online]); // eslint-disable-line

  // 1) Date-range sales export — every transaction in the period.
  const exportRangeCsv = () => {
    if (!range?.orders?.length) { toast('No sales in this date range', 'info'); return; }
    const rows = [['Invoice', 'Date', 'Time', 'Cashier', 'Method', 'Subtotal', 'Discount', 'Total']];
    range.orders.forEach(o => {
      const d = new Date(o.createdAt);
      rows.push([o.invoiceNo, d.toISOString().slice(0, 10), d.toLocaleTimeString(), o.cashier || '', methodLabel(o.method), o.subtotal, o.discount, o.total]);
    });
    const tot = range.totals;
    rows.push([]);
    rows.push(['', '', '', '', 'TOTALS', tot.subtotal, tot.discount, tot.revenue]);
    downloadCsv(`sales-${from}_to_${to}.csv`, rows);
    toast('Sales export downloaded');
  };

  // 2) Z-report CSV (daily close-out).
  const exportZCsv = () => {
    if (!zData) { toast('Run the Z-report first', 'info'); return; }
    const m = zData.byMethod || [];
    const rows = [
      ['Z-Report (daily close-out)', zData.date],
      [],
      ['Summary', 'Amount (FCFA)'],
      ['Gross sales', zData.totals.revenue],
      ['Discounts', zData.totals.discount],
      ['Transactions', zData.totals.orders],
      ['Gross margin', zData.margin.grossProfit],
      [],
      ['Payment method', 'Sales', 'Amount (FCFA)'],
      ...m.map(x => [methodLabel(x.method), x.orders, x.amount]),
      [],
      ['Expected cash in drawer', zData.expectedCash],
    ];
    downloadCsv(`z-report-${zData.date}.csv`, rows);
    toast('Z-report downloaded');
  };

  // 3) Profit & Loss CSV for the selected range — revenue, COGS, gross
  // profit, expenses by category, and the bottom-line net profit.
  const exportPnlCsv = () => {
    if (!pnl) { toast('Run the report first', 'info'); return; }
    const rows = [
      ['Profit & Loss', `${pnl.from} to ${pnl.to}`],
      [],
      ['Revenue', pnl.revenue],
      ['Cost of goods sold', -pnl.cogs],
      ['Gross profit', pnl.grossProfit],
      ['Gross margin %', pnl.grossMarginPct.toFixed(1)],
      [],
      ['Expenses by category'],
      ...pnl.expensesByCategory.map(e => [e.category || 'Uncategorized', -e.amount]),
      ['Total expenses', -pnl.totalExpenses],
      [],
      ['Net profit', pnl.netProfit],
      ['Net margin %', pnl.netMarginPct.toFixed(1)],
    ];
    downloadCsv(`profit-loss-${from}_to_${to}.csv`, rows);
    toast('P&L exported');
  };

  const genSalesReport = exportRangeCsv;
  const genInventoryReport = async () => {
    let items = products.map(p => ({ name: p.name, sku: p.sku, category: p.category, price: p.price, cost: p.cost || 0, stock: p.stock }));
    if (online) { try { const r = await api.inventoryReport(); items = r.products; } catch {} }
    const rows = [['Product', 'SKU', 'Category', 'Cost', 'Price', 'Unit margin', 'Stock', 'Stock value (cost)', 'Stock value (retail)']];
    items.forEach(p => rows.push([p.name, p.sku, p.category, p.cost || 0, p.price, p.price - (p.cost || 0), p.stock, (p.cost || 0) * p.stock, p.price * p.stock]));
    downloadCsv(`inventory-report-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast('Inventory report generated');
  };
  const exportRevenuePdf = () => {
    // Print-to-PDF: opens the browser's print dialog where the user can "Save as PDF".
    toast('Opening print dialog — choose “Save as PDF”', 'info');
    setTimeout(() => window.print(), 250);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-stone-50/30 p-5 md:p-7">
      {can.seeFinance && <>
      {/* ---- Accounting: date-range figures, margin, exports ---- */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200/80 mb-5">
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <h3 className="font-serif text-lg text-stone-900" style={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}>Accounting</h3>
            <p className="text-xs text-stone-500 mt-0.5">Pick a date range, then export sales or margin.</p>
          </div>
          <div className="flex items-end gap-2 ml-auto">
            <div>
              <label className="block text-[11px] text-stone-500 mb-1">From</label>
              <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)}
                className="px-2.5 py-1.5 border border-stone-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-[11px] text-stone-500 mb-1">To</label>
              <input type="date" value={to} min={from} max={today} onChange={e => setTo(e.target.value)}
                className="px-2.5 py-1.5 border border-stone-200 rounded-lg text-sm" />
            </div>
            <button onClick={runRange} disabled={loading}
              className="px-4 py-1.5 rounded-lg bg-rose-900 text-white text-sm font-medium hover:bg-rose-800 disabled:opacity-50">
              {loading ? 'Running…' : 'Run'}
            </button>
          </div>
        </div>

        {range ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-stone-50 rounded-xl p-3">
                <div className="text-[11px] text-stone-500">Gross sales</div>
                <div className="text-lg font-semibold text-stone-900">{fmt(range.totals.revenue)}</div>
              </div>
              <div className="bg-stone-50 rounded-xl p-3">
                <div className="text-[11px] text-stone-500">Discounts given</div>
                <div className="text-lg font-semibold text-stone-900">{fmt(range.totals.discount)}</div>
              </div>
              <div className="bg-stone-50 rounded-xl p-3">
                <div className="text-[11px] text-stone-500">Transactions</div>
                <div className="text-lg font-semibold text-stone-900">{range.totals.orders}</div>
              </div>
              <div className="bg-rose-50 rounded-xl p-3">
                <div className="text-[11px] text-rose-700">Gross margin</div>
                <div className="text-lg font-semibold text-rose-900">{fmt(range.margin.grossProfit)}</div>
                <div className="text-[10px] text-rose-700">{range.margin.marginPct.toFixed(1)}% · cost {fmt(range.margin.cost)}</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-stone-500 mr-1">By payment:</span>
              {(range.byMethod.length ? range.byMethod : [{ method: '—', orders: 0, amount: 0 }]).map(m => (
                <span key={m.method} className="text-xs bg-stone-100 rounded-full px-2.5 py-1">
                  {methodLabel(m.method)}: <span className="font-medium">{fmt(m.amount)}</span> ({m.orders})
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-stone-100">
              <button onClick={exportRangeCsv} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-rose-900 text-white rounded-lg hover:bg-rose-800"><Download size={14} /> Sales export (CSV)</button>
            </div>
          </>
        ) : (
          <div className="text-sm text-stone-400 py-4">{online ? 'Choose a range and press Run.' : 'Connect to the backend to use accounting reports.'}</div>
        )}
      </div>

      {/* ---- Profit & Loss: revenue minus COGS minus expenses, for the same range ---- */}
      {pnl && (
        <div className="bg-white rounded-2xl p-5 border border-stone-200/80 mb-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-serif text-lg text-stone-900" style={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}>Profit &amp; Loss</h3>
              <p className="text-xs text-stone-500 mt-0.5">{pnl.from} to {pnl.to}</p>
            </div>
            <button onClick={exportPnlCsv} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-stone-200 rounded-lg hover:bg-stone-50">
              <Download size={14} /> P&amp;L export (CSV)
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-stone-50 rounded-xl p-3">
              <div className="text-[11px] text-stone-500">Revenue</div>
              <div className="text-lg font-semibold text-stone-900">{fmt(pnl.revenue)}</div>
            </div>
            <div className="bg-stone-50 rounded-xl p-3">
              <div className="text-[11px] text-stone-500">Cost of goods sold</div>
              <div className="text-lg font-semibold text-stone-900">−{fmt(pnl.cogs)}</div>
            </div>
            <div className="bg-stone-50 rounded-xl p-3">
              <div className="text-[11px] text-stone-500">Gross profit</div>
              <div className="text-lg font-semibold text-stone-900">{fmt(pnl.grossProfit)}</div>
              <div className="text-[10px] text-stone-500">{pnl.grossMarginPct.toFixed(1)}% margin</div>
            </div>
            <div className={`rounded-xl p-3 ${pnl.netProfit >= 0 ? 'bg-emerald-50' : 'bg-rose-50'}`}>
              <div className={`text-[11px] ${pnl.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>Net profit</div>
              <div className={`text-lg font-semibold ${pnl.netProfit >= 0 ? 'text-emerald-900' : 'text-rose-900'}`}>{fmt(pnl.netProfit)}</div>
              <div className={`text-[10px] ${pnl.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{pnl.netMarginPct.toFixed(1)}% margin · expenses {fmt(pnl.totalExpenses)}</div>
            </div>
          </div>
          {pnl.expensesByCategory.length > 0 && (
            <div className="pt-4 border-t border-stone-100">
              <div className="text-xs text-stone-500 mb-2">Expenses by category</div>
              <div className="flex flex-wrap gap-2">
                {pnl.expensesByCategory.map(e => (
                  <span key={e.category} className="text-xs bg-stone-100 rounded-full px-2.5 py-1">
                    {e.category || 'Uncategorized'}: <span className="font-medium">{fmt(e.amount)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- Monthly P&L trend — the actual "month over month" view an owner thinks in ---- */}
      {pnlTrend.length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-stone-200/80 mb-5">
          <div className="mb-4">
            <h3 className="font-serif text-lg text-stone-900" style={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}>Monthly P&amp;L trend</h3>
            <p className="text-xs text-stone-500 mt-0.5">Last {pnlTrend.length} months</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={pnlTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
              <XAxis dataKey="month" stroke="#a8a29e" fontSize={11} axisLine={false} tickLine={false} />
              <YAxis stroke="#a8a29e" fontSize={11} axisLine={false} tickLine={false} tickFormatter={fmtShort} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 12 }} formatter={(v) => fmt(v)} />
              <Bar dataKey="netProfit" name="Net profit" fill="#e11d48" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-stone-500 font-medium border-b border-stone-200/80">
                  <th className="py-2 pr-3">Month</th>
                  <th className="py-2 pr-3">Revenue</th>
                  <th className="py-2 pr-3">COGS</th>
                  <th className="py-2 pr-3">Gross profit</th>
                  <th className="py-2 pr-3">Expenses</th>
                  <th className="py-2 pr-3">Net profit</th>
                </tr>
              </thead>
              <tbody>
                {pnlTrend.map(m => (
                  <tr key={m.month} className="border-b border-stone-100 last:border-0">
                    <td className="py-2 pr-3 font-medium text-stone-900">{m.month}</td>
                    <td className="py-2 pr-3 text-stone-700">{fmt(m.revenue)}</td>
                    <td className="py-2 pr-3 text-stone-700">{fmt(m.cogs)}</td>
                    <td className="py-2 pr-3 text-stone-700">{fmt(m.grossProfit)}</td>
                    <td className="py-2 pr-3 text-stone-700">{fmt(m.expenses)}</td>
                    <td className={`py-2 pr-3 font-medium ${m.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{fmt(m.netProfit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---- Daily Z-report (close-out) ---- */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200/80 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-serif text-lg text-stone-900" style={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}>Daily Z-Report</h3>
            <p className="text-xs text-stone-500 mt-0.5">Today's close-out · {today}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={runZ} className="px-3 py-2 text-xs font-medium border border-stone-200 rounded-lg hover:bg-stone-50">Refresh</button>
            <button onClick={exportZCsv} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700"><Download size={14} /> Z-Report (CSV)</button>
          </div>
        </div>
        {zData ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-stone-50 rounded-xl p-3"><div className="text-[11px] text-stone-500">Sales today</div><div className="text-lg font-semibold text-stone-900">{fmt(zData.totals.revenue)}</div></div>
            <div className="bg-stone-50 rounded-xl p-3"><div className="text-[11px] text-stone-500">Transactions</div><div className="text-lg font-semibold text-stone-900">{zData.totals.orders}</div></div>
            <div className="bg-stone-50 rounded-xl p-3"><div className="text-[11px] text-stone-500">Discounts</div><div className="text-lg font-semibold text-stone-900">{fmt(zData.totals.discount)}</div></div>
            <div className="bg-rose-50 rounded-xl p-3"><div className="text-[11px] text-rose-700">Expected cash drawer</div><div className="text-lg font-semibold text-rose-900">{fmt(zData.expectedCash)}</div></div>
          </div>
        ) : (
          <div className="text-sm text-stone-400 py-2">{online ? 'Press Refresh to load today\u2019s figures.' : 'Connect to the backend to run the Z-report.'}</div>
        )}
      </div>
      </>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <div className="bg-white rounded-2xl p-5 border border-stone-200/80">
          <FileText size={20} className="text-rose-700 mb-3" />
          <h3 className="font-serif text-base text-stone-900 mb-1" style={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}>{t('sales_report')}</h3>
          <p className="text-xs text-stone-500 mb-3">{t('sales_report_desc')}</p>
          <button onClick={genSalesReport} className="text-xs font-medium text-rose-700 flex items-center gap-1">{t('generate')} <ChevronRight size={12} /></button>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-stone-200/80">
          <Package size={20} className="text-rose-700 mb-3" />
          <h3 className="font-serif text-base text-stone-900 mb-1" style={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}>{t('inv_report')}</h3>
          <p className="text-xs text-stone-500 mb-3">{t('inv_report_desc')}</p>
          <button onClick={genInventoryReport} className="text-xs font-medium text-rose-700 flex items-center gap-1">{t('generate')} <ChevronRight size={12} /></button>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 border border-stone-200/80 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-serif text-lg text-stone-900" style={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}>{t('revenue_trend')}</h3>
            <p className="text-xs text-stone-500 mt-0.5">{t('past_7_days')}</p>
          </div>
          <button onClick={exportRevenuePdf} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-stone-200 rounded-lg hover:bg-stone-50">
            <Download size={14} /> {t('export_pdf')}
          </button>
        </div>
        {weeklySales.length === 0 ? (
          <div className="h-[280px] flex items-center justify-center text-sm text-stone-400">No sales recorded yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={weeklySales}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
              <XAxis dataKey="label" stroke="#a8a29e" fontSize={11} axisLine={false} tickLine={false} />
              <YAxis stroke="#a8a29e" fontSize={11} axisLine={false} tickLine={false} tickFormatter={fmtShort} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 12 }} formatter={(v, n) => n === 'sales' ? fmt(v) : v} />
              <Line type="monotone" dataKey="sales" stroke="#e11d48" strokeWidth={2.5} dot={{ r: 4, fill: '#e11d48' }} />
              <Line type="monotone" dataKey="orders" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-gradient-to-br from-stone-50 to-rose-50/40 rounded-2xl p-5 border border-stone-200/80">
        <div className="flex items-center gap-3 mb-4">
          <Zap size={18} className="text-amber-600" />
          <h3 className="font-serif text-lg text-stone-900" style={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}>{t('integrations')}</h3>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {['Sage Accounting', 'QuickBooks', 'MTN Mobile Money', 'Orange Money'].map(int => (
            <div key={int} className="bg-white rounded-xl p-3 border border-stone-200/80 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
                <CheckCircle2 size={14} className="text-emerald-700" />
              </div>
              <div>
                <div className="text-sm font-medium text-stone-900">{int}</div>
                <div className="text-[10px] text-emerald-700">{t('connected')}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ---- Recent Sales — admin can edit any transaction ---- */}
      {can.admin && (
        <div className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden">
          <div className="p-5 border-b border-stone-200/80 flex items-center justify-between">
            <div>
              <h3 className="font-serif text-lg text-stone-900" style={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}>Recent Sales</h3>
              <p className="text-xs text-stone-500 mt-0.5">Click Edit to correct an entry — stock is automatically reconciled.</p>
            </div>
            <button onClick={loadOrders} className="text-xs px-3 py-1.5 border border-stone-200 rounded-lg hover:bg-stone-50 flex items-center gap-1.5">
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-stone-500 font-medium border-b border-stone-200/80">
                  <th className="px-5 py-3">Invoice</th>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Cashier</th>
                  <th className="px-3 py-3">Method</th>
                  <th className="px-3 py-3 text-right">Total</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {!ordersLoaded ? (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-stone-400">Loading…</td></tr>
                ) : recentOrders.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-stone-400">No sales yet.</td></tr>
                ) : recentOrders.slice(0, 100).map(o => (
                  <tr key={o.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                    <td className="px-5 py-3 text-sm font-mono text-stone-700">{o.invoiceNo}</td>
                    <td className="px-3 py-3 text-xs text-stone-600">{new Date(o.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-3 text-sm text-stone-700">{o.cashier || '—'}</td>
                    <td className="px-3 py-3 text-xs">
                      <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 capitalize">{o.method || '—'}</span>
                    </td>
                    <td className="px-3 py-3 text-sm font-semibold text-stone-900 text-right">{fmt(o.total)}</td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => setEditOrderId(o.id)}
                        className="text-xs text-amber-700 hover:text-amber-900 font-medium flex items-center gap-1 ml-auto">
                        <Edit2 size={12} /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <SaleEditModal
        orderId={editOrderId}
        open={!!editOrderId}
        onClose={() => setEditOrderId(null)}
        onSaved={loadOrders}
      />
    </div>
  );
};

// ============ SETTINGS ============
const Toggle = ({ checked, onChange }) => (
  <button onClick={() => onChange(!checked)}
    className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-rose-700' : 'bg-stone-300'}`}>
    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
  </button>
);

const SettingsField = ({ label, hint, children }) => (
  <div className="flex items-start justify-between gap-6 py-3.5 border-b border-stone-100 last:border-0">
    <div className="flex-1 min-w-0 pt-1">
      <div className="text-sm font-medium text-stone-900">{label}</div>
      {hint && <div className="text-xs text-stone-500 mt-0.5">{hint}</div>}
    </div>
    <div className="flex-shrink-0">{children}</div>
  </div>
);

const TextInput = ({ value, onChange, placeholder, width = 'w-64' }) => (
  <input type="text" value={value} onChange={e => onChange?.(e.target.value)} placeholder={placeholder}
    className={`${width} px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-100`} />
);

const Select = ({ value, onChange, options, width = 'w-64' }) => (
  <select value={value} onChange={e => onChange?.(e.target.value)}
    className={`${width} px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-100 cursor-pointer`}>
    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

const SettingsCard = ({ title, desc, children }) => (
  <div className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden">
    <div className="px-6 py-4 border-b border-stone-200/80">
      <h3 className="font-serif text-lg text-stone-900" style={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}>{title}</h3>
      {desc && <p className="text-xs text-stone-500 mt-0.5">{desc}</p>}
    </div>
    <div className="px-6 py-2">{children}</div>
  </div>
);

// Every PDF the software generates should start here, so they all carry the
// same branded letterhead instead of each generator inventing its own header.
// Colors match the brand emerald used everywhere else (sidebar, primary
// buttons, login) rather than a one-off shade picked per document.
async function createLetterheadPdf({ docTitle, settings = {} } = {}) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 56;
  const bandHeight = 96;

  // Header band + a warm accent rule under it, echoing the rose-on-cream
  // palette used across the app rather than a flat single-color block.
  doc.setFillColor(136, 19, 55); // rose-900
  doc.rect(0, 0, pageWidth, bandHeight, 'F');
  doc.setFillColor(217, 119, 6); // amber-600
  doc.rect(0, bandHeight, pageWidth, 3, 'F');

  // Logo mark: a white rounded square with the business's initials, the same
  // monogram-avatar pattern used for staff initials elsewhere in the app —
  // derived from settings so it follows the configured business name rather
  // than a hardcoded company.
  const businessName = settings.businessName || 'Riskyc Fashion';
  const monogram = businessName.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'R';
  const logoSize = 40;
  const logoX = margin;
  const logoY = (bandHeight - logoSize) / 2;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(logoX, logoY, logoSize, logoSize, 8, 8, 'F');
  doc.setTextColor(136, 19, 55);
  doc.setFont('times', 'bold');
  doc.setFontSize(monogram.length > 1 ? 16 : 22);
  doc.text(monogram, logoX + logoSize / 2, logoY + logoSize / 2 + (monogram.length > 1 ? 5.5 : 7), { align: 'center' });

  // Business name (serif, echoing the Fraunces headings used on-screen —
  // jsPDF only ships Helvetica/Times/Courier, so Times stands in for it)
  // plus a contact line built from whatever business details are configured.
  const textX = logoX + logoSize + 14;
  doc.setTextColor(255, 255, 255);
  doc.setFont('times', 'bold');
  doc.setFontSize(19);
  doc.text(businessName, textX, bandHeight / 2 - 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const contactBits = [settings.address, settings.phone, settings.email].filter(Boolean).join('   •   ');
  if (contactBits) doc.text(contactBits, textX, bandHeight / 2 + 14);

  // Document title (e.g. "PAYSLIP"), right-aligned within the band.
  if (docTitle) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(docTitle.toUpperCase(), pageWidth - margin, bandHeight / 2, { align: 'right' });
  }

  return { doc, margin, startY: bandHeight + 3 + 40 };
}

// Stamps a matching footer (registration numbers, generation date, page
// count) onto every page of a letterhead PDF — called once after all
// content is drawn, since page count isn't known until then.
function finishLetterheadPdf(doc, { settings = {} } = {}) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 56;
  const pageCount = doc.internal.getNumberOfPages();

  // Signature block — only on the last page, since it signs off the whole
  // document rather than each individual page.
  doc.setPage(pageCount);
  const sigWidth = 160;
  const sigLineY = pageHeight - 110;
  doc.setDrawColor(28, 25, 23);
  doc.setLineWidth(0.75);
  doc.line(pageWidth - margin - sigWidth, sigLineY, pageWidth - margin, sigLineY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(87, 83, 78);
  doc.text('Manager', pageWidth - margin - sigWidth, sigLineY + 14);

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const y = pageHeight - 36;
    doc.setDrawColor(229, 229, 229);
    doc.setLineWidth(0.5);
    doc.line(margin, y - 14, pageWidth - margin, y - 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 113, 108);
    const left = [settings.rccm, settings.niu].filter(Boolean).join('   •   ');
    if (left) doc.text(left, margin, y);
    doc.text(`Page ${i} of ${pageCount}   •   Generated ${new Date().toLocaleDateString()}`, pageWidth - margin, y, { align: 'right' });
  }
}

// WhatsApp can't be made to auto-send a file into someone's DM from a web
// app without paid Business API access and pre-approved templates — see the
// conversation this came out of. This builds a personalized PDF per
// employee and a wa.me link pre-filled with a message containing a link to
// it (wa.me can only pre-fill text, never attach a file); the admin still
// has to click "Send" once per person — there's no way around that part.
const WhatsAppNotifyModal = ({ open, onClose, users }) => {
  const { shifts: liveShifts, settings: liveSettings } = useData();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [msgType, setMsgType] = useState('payslip');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeBody, setNoticeBody] = useState('');
  const [selected, setSelected] = useState({});
  const [generated, setGenerated] = useState([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setGenerated([]);
    setGenerating(false);
    const today = new Date();
    setFrom(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`);
    setTo(today.toISOString().slice(0, 10));
    setNoticeTitle('');
    setNoticeBody('');
    const sel = {};
    users.forEach((u) => { if (u.whatsapp) sel[u.id] = true; });
    setSelected(sel);
  }, [open]); // eslint-disable-line

  const hoursForUser = (userId) => (liveShifts || [])
    .filter((s) => String(s.employeeId) === String(userId) && (s.clockIn || '').slice(0, 10) >= from && (s.clockIn || '').slice(0, 10) <= to)
    .reduce((sum, s) => sum + ((s.clockOut ? new Date(s.clockOut) : new Date()) - new Date(s.clockIn)) / 3600000, 0);

  const buildPdf = async (u) => {
    const { doc, margin, startY } = await createLetterheadPdf({
      docTitle: msgType === 'payslip' ? 'Attendance Summary' : 'Notice',
      settings: liveSettings || {},
    });
    const pageWidth = doc.internal.pageSize.getWidth();

    let y = startY;
    doc.setTextColor(28, 25, 23);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text(u.name, margin, y);
    y += 26;
    doc.setFontSize(11);

    if (msgType === 'payslip') {
      // No hourly-rate pay calculation — pay isn't computed from hours here;
      // shortfalls are made up with extra work rather than deducted, so this
      // is an attendance summary, not a wage computation.
      const hours = hoursForUser(u.id);
      doc.setFont('helvetica', 'normal');
      [
        `Period: ${from} to ${to}`,
        `Role: ${u.role}`,
      ].forEach((line) => { doc.text(line, margin, y); y += 20; });
      y += 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(`Hours worked: ${hours.toFixed(1)}`, margin, y);
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(noticeTitle || 'Notice', margin, y);
      y += 22;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.text(doc.splitTextToSize(noticeBody || '', pageWidth - margin * 2), margin, y);
    }
    finishLetterheadPdf(doc, { settings: liveSettings || {} });
    return doc;
  };

  const pdfToDataUrl = (doc) => new Promise((resolve, reject) => {
    const blob = doc.output('blob');
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read generated PDF'));
    reader.readAsDataURL(blob);
  });

  const eligible = users.filter((u) => selected[u.id] && u.whatsapp);

  const generate = async () => {
    if (msgType === 'notice' && !noticeBody.trim()) { toast('Write the notice message first', 'error'); return; }
    if (eligible.length === 0) { toast('Select at least one employee with a WhatsApp number', 'error'); return; }
    setGenerating(true);
    const results = [];
    for (const u of eligible) {
      try {
        const doc = await buildPdf(u);
        const dataUrl = await pdfToDataUrl(doc);
        const { path } = await api.uploadDocument(`${msgType}-${u.name}`, dataUrl);
        const pdfUrl = `${window.location.origin}${path}`;
        const text = msgType === 'payslip'
          ? `Hello ${u.name}, here is your attendance summary for ${from} to ${to}: ${pdfUrl}`
          : `Hello ${u.name}, ${noticeTitle ? noticeTitle + ' — ' : ''}please see: ${pdfUrl}`;
        results.push({ user: u, pdfUrl, waLink: `https://wa.me/${normalizePhone(u.whatsapp)}?text=${encodeURIComponent(text)}` });
      } catch (e) {
        toast(`Could not generate a PDF for ${u.name}: ${e.message}`, 'error');
      }
    }
    setGenerated(results);
    setGenerating(false);
    if (results.length) setStep(2);
  };

  const toggleAll = (value) => {
    const sel = {};
    users.forEach((u) => { if (u.whatsapp) sel[u.id] = value; });
    setSelected(sel);
  };

  return (
    <Modal open={open} onClose={onClose} title={step === 1 ? 'Notify via WhatsApp' : 'Send to each employee'}
      footer={step === 1 ? (
        <>
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn onClick={generate} disabled={generating}>{generating ? 'Generating…' : 'Generate'}</PrimaryBtn>
        </>
      ) : (
        <PrimaryBtn onClick={onClose}>Done</PrimaryBtn>
      )}>
      {step === 1 ? (
        <>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {[{ id: 'payslip', label: 'Attendance summary' }, { id: 'notice', label: 'General notice' }].map((opt) => (
              <button key={opt.id} type="button" onClick={() => setMsgType(opt.id)}
                className={`py-2.5 rounded-lg text-sm font-medium border ${msgType === opt.id ? 'border-rose-900 bg-rose-900 text-white' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
                {opt.label}
              </button>
            ))}
          </div>

          {msgType === 'payslip' ? (
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
              <Field label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
            </div>
          ) : (
            <>
              <Field label="Title"><Input value={noticeTitle} onChange={(e) => setNoticeTitle(e.target.value)} placeholder="e.g. Schedule change" /></Field>
              <Field label="Message">
                <textarea value={noticeBody} onChange={(e) => setNoticeBody(e.target.value)} rows={4}
                  className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-100" />
              </Field>
            </>
          )}

          <div className="flex items-center justify-between mt-4 mb-1">
            <div className="text-xs font-medium text-stone-600">Send to</div>
            <div className="flex gap-3 text-xs">
              <button type="button" onClick={() => toggleAll(true)} className="text-rose-700 hover:text-rose-900">Select all</button>
              <button type="button" onClick={() => toggleAll(false)} className="text-stone-500 hover:text-stone-700">Select none</button>
            </div>
          </div>
          <div className="border border-stone-200 rounded-lg divide-y divide-stone-100 max-h-52 overflow-y-auto">
            {users.map((u) => (
              <label key={u.id} className={`flex items-center gap-3 px-3 py-2 ${u.whatsapp ? 'cursor-pointer hover:bg-stone-50' : 'opacity-50'}`}>
                <input type="checkbox" disabled={!u.whatsapp} checked={!!selected[u.id]}
                  onChange={(e) => setSelected((s) => ({ ...s, [u.id]: e.target.checked }))}
                  className="h-4 w-4 rounded border-stone-300 text-rose-600 focus:ring-rose-500" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-stone-900 truncate">{u.name}</div>
                  <div className="text-xs text-stone-400">{u.whatsapp || 'No WhatsApp number on file'}</div>
                </div>
              </label>
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-stone-600 mb-2">A PDF was generated for each person below. Click "Send" to open WhatsApp with the message ready — you still need to press Send there yourself, once per person.</p>
          {generated.map(({ user: u, pdfUrl, waLink }) => (
            <div key={u.id} className="flex items-center gap-3 px-3 py-2 border border-stone-200 rounded-lg">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-stone-900 truncate">{u.name}</div>
                <a href={pdfUrl} target="_blank" rel="noreferrer" className="text-xs text-rose-700 hover:underline">View PDF</a>
              </div>
              <a href={waLink} target="_blank" rel="noreferrer"
                className="px-3 py-1.5 bg-rose-900 text-white rounded-lg text-xs font-medium hover:bg-rose-800 flex-shrink-0">Send</a>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
};

// Customer promo broadcast — same wa.me one-click-per-person mechanism as
// WhatsAppNotifyModal above, but text-only (no PDF/upload step): a promo
// message doesn't need a generated document, so this skips straight from
// "compose" to "one link per recipient" in a single step.
const WhatsAppPromoModal = ({ open, onClose, customers }) => {
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setMessage('');
  }, [open]);

  const eligible = customers.filter((c) => c.phone);
  const links = eligible.map((c) => ({
    customer: c,
    waLink: `https://wa.me/${normalizePhone(c.phone)}?text=${encodeURIComponent(message.replace(/\{name\}/gi, c.name))}`,
  }));

  const send = () => {
    if (!message.trim()) { toast('Write the promo message first', 'error'); return; }
    if (eligible.length === 0) { toast('None of the selected customers have a phone number on file', 'error'); return; }
    setStep(2);
  };

  return (
    <Modal open={open} onClose={onClose} title={step === 1 ? `Notify ${customers.length} customer${customers.length > 1 ? 's' : ''} via WhatsApp` : 'Send to each customer'}
      footer={step === 1 ? (
        <>
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn onClick={send}>Continue</PrimaryBtn>
        </>
      ) : (
        <PrimaryBtn onClick={onClose}>Done</PrimaryBtn>
      )}>
      {step === 1 ? (
        <>
          <Field label="Message">
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5}
              placeholder="e.g. Hi {name}, enjoy 20% off this weekend at Riskyc Fashion — see you in store!"
              className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-100" />
          </Field>
          <div className="text-[11px] text-stone-400 mb-1">Use <span className="font-mono">{'{name}'}</span> to personalize each message.</div>
          <div className="text-xs text-stone-500 mt-3">
            {eligible.length} of {customers.length} selected customer{customers.length > 1 ? 's' : ''} have a phone number on file.
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-stone-600 mb-2">Click "Send" to open WhatsApp with the message ready for that customer — you still need to press Send there yourself, once per person.</p>
          {links.map(({ customer: c, waLink }) => (
            <div key={c.id} className="flex items-center gap-3 px-3 py-2 border border-stone-200 rounded-lg">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-stone-900 truncate">{c.name}</div>
                <div className="text-xs text-stone-400">{c.phone}</div>
              </div>
              <a href={waLink} target="_blank" rel="noreferrer"
                className="px-3 py-1.5 bg-rose-900 text-white rounded-lg text-xs font-medium hover:bg-rose-800 flex-shrink-0">Send</a>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
};

const SettingsView = () => {
  const { t, lang, setLang } = useT();
  const [tab, setTab] = useState('general');
  const [settings, setSettings] = useState({
    businessName: 'Riskyc Fashion',
    currency: 'XAF',
    timezone: 'Africa/Douala',
    dateFormat: 'DD/MM/YYYY',
    address: 'Rue Joss, Bonanjo, Douala',
    phone: '+237 6 77 00 00 00',
    email: 'contact@riskycfashion.cm',
    website: 'www.riskycfashion.cm',
    rccm: 'RC/DLA/2024/B/01234',
    niu: 'P012345678901G',
    receiptHeader: 'Riskyc Fashion — Merci de votre visite',
    receiptFooter: 'Échanges sous 7 jours avec ticket de caisse, articles non portés',
    paperWidth: '80',
    showLogo: true,
    showQR: true,
    taxIdPrint: true,
    acceptCash: true,
    acceptCard: true,
    acceptMobile: true,
    discountPin: '',
    lowStockThreshold: '10',
    dailySummary: true,
    weeklySummary: true,
    paymentAlerts: true,
    multiStore: false,
    catalogEnabled: false,
    useVariants: true,
  });
  const update = (k) => (v) => setSettings(prev => ({ ...prev, [k]: v }));
  // Fetched once, regardless of the toggle, so the shareable link is ready
  // to show the instant someone turns the catalog on — see catalogUrl below.
  const [tenantSlug, setTenantSlug] = useState(null);
  useEffect(() => { api.getTenantInfo().then(({ slug }) => setTenantSlug(slug)).catch(() => {}); }, []);
  const catalogUrl = tenantSlug ? `${window.location.origin}/catalog/${tenantSlug}` : null;

  const { online, settings: liveSettings, users: liveUsers, refresh, patch } = useData();
  const { toast } = useToast();
  const { user: me } = useAuth();
  const [savedSnapshot, setSavedSnapshot] = useState(null);
  const [userModal, setUserModal] = useState(false);
  const [whatsappModal, setWhatsappModal] = useState(false);

  // While the admin is looking at the Users tab, keep the online indicators
  // fresh — heartbeats land server-side every 45s, so poll a bit faster.
  useEffect(() => {
    if (tab !== 'users' || !online) return;
    const id = setInterval(() => { refresh(); }, 20000);
    return () => clearInterval(id);
  }, [tab, online, refresh]);
  const [editingUser, setEditingUser] = useState(null);
  const [pinTarget, setPinTarget] = useState(null);   // user whose PIN is being reset
  const [newPin, setNewPin] = useState('');
  const users = online ? (liveUsers || []) : (liveUsers?.length ? liveUsers : USERS_DATA);
  const isAdmin = me?.role === 'admin';

  // Admin: delete a cashier/manager account (never an admin, never yourself).
  // Requires connectivity — see note on ProductForm.save in shared.jsx.
  const deleteUser = async (u) => {
    if (!window.confirm(`Delete ${u.name}'s account? They will no longer be able to sign in, and their shift records will be removed.`)) return;
    try {
      await api.deleteUser(u.id);
      patch('users', list => list.filter(x => x.id !== u.id));
      patch('shifts', list => list.filter(s => String(s.employeeId) !== String(u.id)));
      toast('Account deleted');
    } catch (e) {
      toast(!e.status ? "Can't delete while offline — try again once connected" : e.message, 'error');
    }
  };
  // Admin/manager: open the reset-PIN dialog for a user.
  const resetPin = (u) => { setPinTarget(u); setNewPin(''); };
  const submitPin = async () => {
    if (!/^\d{4,6}$/.test(newPin)) { toast('PIN must be 4–6 digits', 'error'); return; }
    try {
      await api.setUserPin(pinTarget.id, newPin);
      toast(`PIN reset for ${pinTarget.name}`);
      setPinTarget(null); setNewPin('');
    } catch (e) {
      toast(!e.status ? "Can't reset PIN while offline — try again once connected" : e.message, 'error');
    }
  };

  // Hydrate from the backend once it loads.
  useEffect(() => {
    if (liveSettings && Object.keys(liveSettings).length) {
      setSettings(prev => ({ ...prev, ...liveSettings }));
      setSavedSnapshot(liveSettings);
    }
  }, [liveSettings]);

  // Requires connectivity — see note on ProductForm.save in shared.jsx.
  const saveSettings = async () => {
    try {
      await api.saveSettings(settings);
      setSavedSnapshot(settings);
      patch('settings', () => settings); // propagate to every view sharing this data, not just this form
      toast('Settings saved');
    } catch (e) {
      toast(!e.status ? "Can't save while offline — try again once connected" : e.message, 'error');
    }
  };
  const clearAllData = async () => {
    if (!window.confirm('Clear ALL demo data — inventory, sales, dashboard, customers, suppliers and employees — so the shop starts from scratch?\n\nLogin accounts and settings are kept. It cannot be undone.')) return;
    if (!window.confirm('Are you absolutely sure? Every product, sale, customer, supplier and employee will be permanently deleted. Login accounts are kept.')) return;
    try {
      await api.clearData();
      toast('All demo data cleared — the app now starts from zero');
      refresh();
    } catch (e) {
      toast(!e.status ? "Can't clear data while offline — try again once connected" : e.message, 'error');
    }
  };
  const clearActivity = async () => {
    if (!window.confirm("Reset the Dashboard and Shift history — clears all sales, order history and clock-in/out records so reporting starts fresh?\n\nProducts, customers, suppliers, expenses and employees are kept. It cannot be undone.")) return;
    try {
      await api.clearActivity();
      toast('Dashboard and shift history reset');
      refresh();
    } catch (e) {
      toast(!e.status ? "Can't reset while offline — try again once connected" : e.message, 'error');
    }
  };
  const clearToday = async () => {
    const d = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    if (!window.confirm(`Clear all of today's (${d}) sales?\n\nOrders and stock movements for today will be deleted and stock restored. Expenses, shifts, products and all other history are kept. This cannot be undone.`)) return;
    try {
      const r = await api.clearToday();
      toast(`Today's sales cleared — ${r.ordersDeleted} order${r.ordersDeleted !== 1 ? 's' : ''} removed`);
      refresh();
    } catch (e) {
      toast(!e.status ? "Can't clear while offline — try again once connected" : e.message, 'error');
    }
  };
  const cancelSettings = () => {
    if (savedSnapshot) setSettings(prev => ({ ...prev, ...savedSnapshot }));
    toast('Changes discarded', 'info');
  };

  const tabs = [
    { id: 'general', label: t('s_general'), icon: Globe },
    { id: 'business', label: t('s_business'), icon: Building },
    { id: 'receipt', label: t('s_receipt'), icon: Receipt },
    { id: 'tax', label: t('s_tax'), icon: Percent },
    { id: 'payments', label: t('s_payments'), icon: CreditCard },
    { id: 'users', label: t('s_users'), icon: Users },
    { id: 'notifications', label: t('s_notifications'), icon: BellRing },
    { id: 'data', label: 'Data', icon: Trash2 },
  ];

  return (
    <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden bg-stone-50/30">
      {/* Settings sub-nav */}
      <aside className="w-full lg:w-56 border-b lg:border-b-0 lg:border-r border-stone-200/60 p-3 lg:p-4 lg:overflow-y-auto bg-white/50 flex-shrink-0">
        <div className="hidden lg:block text-[10px] uppercase tracking-widest text-stone-500 font-medium px-2 mb-2">{t('settings')}</div>
        <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible" style={{ scrollbarWidth: 'none' }}>
          {tabs.map(tb => {
            const Icon = tb.icon;
            const active = tab === tb.id;
            return (
              <button key={tb.id} onClick={() => setTab(tb.id)}
                className={`lg:w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all whitespace-nowrap flex-shrink-0 ${
                  active ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
                }`}>
                <Icon size={15} strokeWidth={1.8} /><span className="font-medium">{tb.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 lg:overflow-y-auto p-4 sm:p-7">
        <div className="max-w-3xl space-y-5">
          {tab === 'general' && (
            <>
              <SettingsCard title={t('s_general')} desc="Basic preferences for your POS">
                <SettingsField label={t('language')} hint="Interface language">
                  <Select value={lang} onChange={setLang} options={[{ value: 'en', label: 'English' }, { value: 'fr', label: 'Français' }]} width="w-40" />
                </SettingsField>
                <SettingsField label={t('currency')} hint="Used throughout the system">
                  <Select value={settings.currency} onChange={update('currency')} options={[
                    { value: 'XAF', label: 'FCFA (XAF)' }, { value: 'EUR', label: 'Euro (EUR)' }, { value: 'USD', label: 'US Dollar (USD)' }, { value: 'NGN', label: 'Naira (NGN)' }
                  ]} width="w-40" />
                </SettingsField>
                <SettingsField label={t('timezone')}>
                  <Select value={settings.timezone} onChange={update('timezone')} options={[
                    { value: 'Africa/Douala', label: 'Africa/Douala (WAT)' }, { value: 'Africa/Lagos', label: 'Africa/Lagos (WAT)' }, { value: 'Europe/Paris', label: 'Europe/Paris (CET)' }
                  ]} width="w-56" />
                </SettingsField>
                <SettingsField label={t('date_format')}>
                  <Select value={settings.dateFormat} onChange={update('dateFormat')} options={[
                    { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' }, { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' }, { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' }
                  ]} width="w-40" />
                </SettingsField>
              </SettingsCard>
              <SettingsCard title="Multiple store locations" desc="Turn on if this shop sells from more than one physical location">
                <SettingsField label="Enable multiple stores" hint="Off = one simple shop, no switcher shown anywhere">
                  <Toggle checked={settings.multiStore} onChange={update('multiStore')} />
                </SettingsField>
              </SettingsCard>
              <SettingsCard title="Product variants" desc="Turn off if your products don't come in different sizes or colors">
                <SettingsField label="Use size/color variants" hint="Off = Add Product shows one simple stock field instead of a variants list">
                  <Toggle checked={settings.useVariants} onChange={update('useVariants')} />
                </SettingsField>
              </SettingsCard>
              <SettingsCard title="Public catalog" desc="A shareable link showing what's currently in stock — post it on WhatsApp/Instagram. Browse-only, no orders taken through it. Never shows cost, stock counts, or anything about customers/sales.">
                <SettingsField label="Enable public catalog" hint="Off by default — turn on when you're ready to share the link">
                  <Toggle checked={settings.catalogEnabled} onChange={update('catalogEnabled')} />
                </SettingsField>
                {settings.catalogEnabled && (
                  <div className="pt-3.5">
                    <div className="text-xs font-medium text-stone-600 mb-1.5">Your catalog link</div>
                    {catalogUrl ? (
                      <div className="flex items-center gap-2">
                        <input readOnly value={catalogUrl}
                          className="flex-1 px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-700 font-mono" />
                        <button onClick={() => { navigator.clipboard?.writeText(catalogUrl); toast('Link copied'); }}
                          className="px-3 py-2 bg-rose-900 text-white rounded-lg text-xs font-medium hover:bg-rose-800 flex-shrink-0">
                          Copy
                        </button>
                        <a href={catalogUrl} target="_blank" rel="noreferrer"
                          className="px-3 py-2 border border-stone-200 rounded-lg text-xs font-medium text-stone-600 hover:bg-stone-50 flex-shrink-0">
                          Preview
                        </a>
                      </div>
                    ) : (
                      <div className="text-xs text-stone-400">Loading link…</div>
                    )}
                    <div className="text-[11px] text-stone-400 mt-2">
                      Remember to click <span className="font-medium">Save changes</span> below for this to take effect.
                    </div>
                  </div>
                )}
              </SettingsCard>
            </>
          )}

          {tab === 'business' && (
            <SettingsCard title={t('s_business')} desc="Information printed on receipts and invoices">
              <SettingsField label={t('business_name')}>
                <TextInput value={settings.businessName} onChange={update('businessName')} />
              </SettingsField>
              <SettingsField label={t('address')}>
                <TextInput value={settings.address} onChange={update('address')} width="w-80" />
              </SettingsField>
              <SettingsField label={t('phone')}>
                <TextInput value={settings.phone} onChange={update('phone')} />
              </SettingsField>
              <SettingsField label={t('email')}>
                <TextInput value={settings.email} onChange={update('email')} />
              </SettingsField>
              <SettingsField label={t('website')}>
                <TextInput value={settings.website} onChange={update('website')} />
              </SettingsField>
              <SettingsField label={t('rccm')} hint="Trade registry number">
                <TextInput value={settings.rccm} onChange={update('rccm')} />
              </SettingsField>
              <SettingsField label={t('niu')} hint="Unique tax identification number">
                <TextInput value={settings.niu} onChange={update('niu')} />
              </SettingsField>
            </SettingsCard>
          )}

          {tab === 'receipt' && (
            <SettingsCard title={t('s_receipt')} desc="Customize how receipts appear and print">
              <SettingsField label={t('receipt_header')} hint="Top line on the receipt">
                <TextInput value={settings.receiptHeader} onChange={update('receiptHeader')} width="w-80" />
              </SettingsField>
              <SettingsField label={t('receipt_footer')}>
                <TextInput value={settings.receiptFooter} onChange={update('receiptFooter')} width="w-80" />
              </SettingsField>
              <SettingsField label={t('paper_width')}>
                <Select value={settings.paperWidth} onChange={update('paperWidth')} options={[
                  { value: '58', label: '58mm (compact)' }, { value: '80', label: '80mm (standard)' }
                ]} width="w-44" />
              </SettingsField>
              <SettingsField label={t('show_logo')}>
                <Toggle checked={settings.showLogo} onChange={update('showLogo')} />
              </SettingsField>
              <SettingsField label={t('show_qr')} hint="Required for DGI e-invoice compliance">
                <Toggle checked={settings.showQR} onChange={update('showQR')} />
              </SettingsField>
            </SettingsCard>
          )}

          {tab === 'tax' && (
            <>
              <SettingsCard title={t('s_tax')} desc="Tax-related settings for Cameroon — this shop doesn't charge TVA">
                <SettingsField label={t('tax_id_print')}>
                  <Toggle checked={settings.taxIdPrint} onChange={update('taxIdPrint')} />
                </SettingsField>
              </SettingsCard>

              <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 rounded-2xl p-5 border border-amber-200/60">
                <div className="flex items-start gap-3">
                  <ShieldCheck size={20} className="text-amber-700 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-stone-900 mb-1">DGI e-invoice compliance</h4>
                    <p className="text-xs text-stone-600 leading-relaxed">Your receipts are configured for compliance with the Direction Générale des Impôts. Every transaction is logged with its tax ID and verifiable QR code.</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {tab === 'payments' && (
            <SettingsCard title={t('s_payments')} desc="Choose which payment methods to accept">
              <SettingsField label={t('accept_cash')} hint="Espèces / banknotes">
                <Toggle checked={settings.acceptCash} onChange={update('acceptCash')} />
              </SettingsField>
              <SettingsField label={t('accept_card')} hint="Visa, Mastercard via terminal">
                <Toggle checked={settings.acceptCard} onChange={update('acceptCard')} />
              </SettingsField>
              <SettingsField label={t('accept_mobile')} hint="MTN MoMo, Orange Money">
                <Toggle checked={settings.acceptMobile} onChange={update('acceptMobile')} />
              </SettingsField>
            </SettingsCard>
          )}

          {tab === 'users' && (
            <div className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden">
              <div className="px-6 py-4 border-b border-stone-200/80 flex items-center justify-between">
                <div>
                  <h3 className="font-serif text-lg text-stone-900" style={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}>{t('s_users')}</h3>
                  <p className="text-xs text-stone-500 mt-0.5">Team members and their permissions</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    {users.filter(u => u.online).length} online
                  </span>
                  <button onClick={() => setWhatsappModal(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-stone-200 text-stone-700 rounded-lg hover:bg-stone-50">
                    <MessageCircle size={13} /> Notify via WhatsApp
                  </button>
                  <button onClick={() => { setEditingUser(null); setUserModal(true); }} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-rose-900 text-white rounded-lg hover:bg-rose-800">
                    <Plus size={13} /> Add user
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-widest text-stone-500 font-medium border-b border-stone-200/80">
                    <th className="px-6 py-3">{t('user')}</th>
                    <th className="px-3 py-3">{t('role')}</th>
                    <th className="px-3 py-3">{t('stores')}</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/50">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center text-white text-xs font-semibold">
                            {u.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-stone-900">{u.name}</div>
                            <div className="text-xs text-stone-500">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded-md ${
                          u.role === 'admin' ? 'bg-rose-50 text-rose-700' :
                          u.role === 'manager' ? 'bg-amber-50 text-amber-700' :
                          'bg-sky-50 text-sky-700'
                        }`}>
                          {t(u.role)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm text-stone-700">{u.store}</td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${u.online ? 'bg-emerald-500 animate-pulse' : 'bg-stone-300'}`} />
                          {u.online
                            ? <span className="text-emerald-700 font-medium">Online</span>
                            : <span className="text-stone-500">{relativeLastActive(u.lastActive)}</span>}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right whitespace-nowrap">
                        <button onClick={() => { setEditingUser(u); setUserModal(true); }} className="text-xs text-stone-500 hover:text-stone-900">{t('edit')}</button>
                        <button onClick={() => resetPin(u)} className="text-xs text-stone-500 hover:text-rose-700 ml-3">Reset PIN</button>
                        {isAdmin && u.role !== 'admin' && u.id !== me?.id && (
                          <button onClick={() => deleteUser(u)} className="text-xs text-rose-600 hover:text-rose-800 ml-3">Delete</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {tab === 'notifications' && (
            <SettingsCard title={t('s_notifications')} desc="Decide what alerts you want to receive">
              <SettingsField label={t('low_stock_threshold')} hint="Alert when items fall below this level">
                <div className="flex items-center gap-2">
                  <TextInput value={settings.lowStockThreshold} onChange={update('lowStockThreshold')} width="w-24" />
                  <span className="text-sm text-stone-500">units</span>
                </div>
              </SettingsField>
              <SettingsField label={t('daily_summary')} hint="End-of-day report via email">
                <Toggle checked={settings.dailySummary} onChange={update('dailySummary')} />
              </SettingsField>
              <SettingsField label={t('weekly_summary')} hint="Mondays at 8 AM">
                <Toggle checked={settings.weeklySummary} onChange={update('weeklySummary')} />
              </SettingsField>
              <SettingsField label={t('payment_alerts')}>
                <Toggle checked={settings.paymentAlerts} onChange={update('paymentAlerts')} />
              </SettingsField>
            </SettingsCard>
          )}

          {tab === 'data' && (
            <SettingsCard title="Data & reset" desc="Start the shop's records over from scratch">
              <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4">
                <h4 className="font-medium text-rose-700 flex items-center gap-2 mb-1"><AlertTriangle size={15} /> Clear all data</h4>
                <p className="text-xs text-stone-600 max-w-lg mb-3">
                  Permanently deletes all products, stock movements, purchase orders, sales history, customers,
                  suppliers, expenses, shifts and employees so the inventory, dashboard and customer records all
                  start from zero. Login accounts and settings are kept — staff don't need to be recreated.
                  This cannot be undone.
                </p>
                <button onClick={clearAllData} className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-700">Clear all data</button>
              </div>

              <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-4 mt-4">
                <h4 className="font-medium text-sky-700 flex items-center gap-2 mb-1"><RefreshCw size={15} /> Clear today's sales</h4>
                <p className="text-xs text-stone-600 max-w-lg mb-3">
                  Removes all orders recorded today and restores the stock that was deducted.
                  Use this if today's entries were test sales or contained errors you want to
                  redo from scratch. Past days, expenses, shifts, products and customers are untouched.
                  This cannot be undone.
                </p>
                <button onClick={clearToday} className="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700">Clear today's sales</button>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 mt-4">
                <h4 className="font-medium text-amber-700 flex items-center gap-2 mb-1"><RefreshCw size={15} /> Reset dashboard &amp; shift history</h4>
                <p className="text-xs text-stone-600 max-w-lg mb-3">
                  Clears sales history, order records and clock-in/out logs so the Dashboard and Shift history
                  start fresh — useful at the start of a new reporting period. Products, customers, suppliers,
                  expenses and employees are kept. This cannot be undone.
                </p>
                <button onClick={clearActivity} className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700">Reset dashboard &amp; shift history</button>
              </div>
            </SettingsCard>
          )}

          {/* Save bar */}
          <div className="sticky bottom-0 bg-stone-50/95 backdrop-blur -mx-7 px-7 py-4 border-t border-stone-200/60 flex items-center justify-end gap-2 mt-6">
            <button onClick={cancelSettings} className="px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 rounded-lg">{t('cancel')}</button>
            <button onClick={saveSettings} className="flex items-center gap-2 px-4 py-2 bg-rose-900 text-white rounded-lg text-sm font-medium hover:bg-rose-800 shadow-sm">
              <Save size={15} />{t('save_changes')}
            </button>
          </div>
        </div>
      </div>
      <UserForm open={userModal} onClose={() => setUserModal(false)} initial={editingUser} />
      <WhatsAppNotifyModal open={whatsappModal} onClose={() => setWhatsappModal(false)} users={users} />

      <Modal open={!!pinTarget} onClose={() => setPinTarget(null)} title={pinTarget ? `Reset PIN — ${pinTarget.name}` : 'Reset PIN'}
        footer={<>
          <GhostBtn onClick={() => setPinTarget(null)}>Cancel</GhostBtn>
          <PrimaryBtn onClick={submitPin}>Save PIN</PrimaryBtn>
        </>}>
        <p className="text-sm text-stone-600 mb-3">Enter a new 4–6 digit login PIN for this user.</p>
        <input
          autoFocus
          type="text" inputMode="numeric" maxLength={6}
          value={newPin}
          onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => { if (e.key === 'Enter') submitPin(); }}
          placeholder="e.g. 1234"
          className="w-full px-3 py-2.5 bg-white border border-stone-200 rounded-lg text-lg tracking-widest text-center focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-100" />
      </Modal>
    </div>
  );
};

// Live camera preview + capture, used right before a clock-in completes.
// The snapshot is the thing standing in for "this is really that person" —
// it gets uploaded and attached to the new shift so a manager can check it
// later, the way fingerprint verification was meant to but couldn't
// reliably do across domains.
//
// Before the capture button unlocks, a lightweight client-side liveness
// check (see liveness.js) requires seeing a face and a blink during this
// session — stops someone just holding up a printed photo. It's a free,
// in-browser deterrent, not the hard guarantee a paid liveness vendor would
// give; a video replay of a blinking person would still pass.
const LIVENESS_POLL_MS = 200;
const LIVENESS_WINDOW_MS = 2000;

const ClockInCameraModal = ({ open, onClose, onCapture }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const livenessTimerRef = useRef(null);
  const earHistoryRef = useRef([]);
  const blinkVerifiedRef = useRef(false);
  const [error, setError] = useState('');
  const [capturing, setCapturing] = useState(false);
  // loading-model | no-face | watching | verified | unavailable
  const [livenessPhase, setLivenessPhase] = useState('loading-model');

  const stopLivenessLoop = () => {
    clearInterval(livenessTimerRef.current);
    livenessTimerRef.current = null;
    earHistoryRef.current = [];
    blinkVerifiedRef.current = false;
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError('');
    setCapturing(false);
    setLivenessPhase('loading-model');
    const tryCamera = (c) => navigator.mediaDevices.getUserMedia(c);
    (navigator.mediaDevices
      ? tryCamera({ video: { facingMode: 'user' }, audio: false })
          .catch(() => tryCamera({ video: true, audio: false }))
      : Promise.reject(Object.assign(new Error('no devices'), { name: 'NotFoundError' }))
    ).then((stream) => {
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = stream;
      requestAnimationFrame(() => {
        if (!cancelled && videoRef.current) videoRef.current.srcObject = stream;
      });
    }).catch((err) => {
      if (cancelled) return;
      const n = err?.name || '';
      if (n === 'NotAllowedError' || n === 'PermissionDeniedError') {
        setError('PERMISSION_DENIED');
      } else if (n === 'NotFoundError' || n === 'DevicesNotFoundError') {
        setError('NO_CAMERA');
      } else if (n === 'NotReadableError' || n === 'TrackStartError') {
        setError('CAMERA_BUSY');
      } else {
        setError('GENERIC');
      }
    });

    // Dynamically imported — face-api.js pulls in TensorFlow.js, which
    // roughly doubles the JS bundle, so it's only fetched when this modal
    // actually opens instead of costing every page load.
    import('./liveness.js')
      .then((liveness) => liveness.loadFaceModels().then(() => liveness))
      .then((liveness) => {
        if (cancelled) return;
        setLivenessPhase('no-face');
        livenessTimerRef.current = setInterval(async () => {
          const video = videoRef.current;
          if (!video || video.readyState < 2) return;
          let ear = null;
          try { ear = await liveness.detectFaceEAR(video); } catch { /* transient — try again next tick */ }
          if (cancelled) return;
          if (ear == null) {
            setLivenessPhase((p) => (p === 'verified' ? 'verified' : 'no-face'));
            return;
          }
          const now = Date.now();
          const hist = earHistoryRef.current;
          hist.push({ t: now, ear });
          while (hist.length && now - hist[0].t > LIVENESS_WINDOW_MS) hist.shift();
          if (!blinkVerifiedRef.current) {
            const recentMin = Math.min(...hist.map((h) => h.ear));
            if (recentMin < liveness.EAR_CLOSED && ear > liveness.EAR_OPEN) blinkVerifiedRef.current = true;
          }
          setLivenessPhase(blinkVerifiedRef.current ? 'verified' : 'watching');
        }, LIVENESS_POLL_MS);
      })
      .catch(() => { if (!cancelled) setLivenessPhase('unavailable'); });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      stopLivenessLoop();
    };
  }, [open]);

  const handleClose = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    stopLivenessLoop();
    onClose();
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    setCapturing(true);
    const width = 480;
    const height = Math.round((480 * video.videoHeight) / video.videoWidth);
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    canvas.getContext('2d').drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    stopLivenessLoop();
    onCapture(dataUrl);
  };

  const livenessMessage = {
    'loading-model': { text: 'Loading face check…', tone: 'stone' },
    'no-face': { text: 'Position your face in the frame', tone: 'amber' },
    'watching': { text: 'Blink to verify it’s really you', tone: 'amber' },
    'verified': { text: 'Verified — you can capture now', tone: 'emerald' },
    'unavailable': { text: 'Face check unavailable — you can still capture your photo', tone: 'amber' },
  }[livenessPhase];

  const canCapture = !error && !capturing;

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-stone-900 flex items-center gap-2"><Camera size={16} /> Clock-in photo</h3>
          <button onClick={handleClose} className="p-1.5 rounded-md hover:bg-stone-100"><X size={15} className="text-stone-500" /></button>
        </div>
        {error ? (
          <div className="py-6 text-center space-y-3">
            {error === 'PERMISSION_DENIED' ? (<>
              <p className="text-sm font-semibold text-rose-700">Camera access blocked</p>
              <p className="text-xs text-stone-500 leading-relaxed">Chrome is blocking the camera for this site. Click the <strong>camera icon</strong> or <strong>lock icon</strong> in the address bar, set Camera to <strong>Allow</strong>, then reload and try again.</p>
            </>) : error === 'NO_CAMERA' ? (<>
              <p className="text-sm font-semibold text-rose-700">No camera found</p>
              <p className="text-xs text-stone-500">Make sure a webcam is plugged in and recognised by Windows, then try again.</p>
            </>) : error === 'CAMERA_BUSY' ? (<>
              <p className="text-sm font-semibold text-rose-700">Camera in use by another app</p>
              <p className="text-xs text-stone-500">Close Zoom, Teams, or any other app using the camera, then try again.</p>
            </>) : (
              <p className="text-sm text-rose-600">Could not access the camera — allow camera permission and try again.</p>
            )}
          </div>
        ) : (
          <>
            <div className="rounded-xl overflow-hidden bg-stone-900 aspect-square mb-3 relative">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
            </div>
          </>
        )}
        <div className="flex gap-2">
          <button onClick={handleClose} className="flex-1 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-100 rounded-lg">Cancel</button>
          <button onClick={capture} disabled={!canCapture}
            className="flex-1 py-2.5 bg-rose-900 text-white rounded-lg text-sm font-medium hover:bg-rose-800 disabled:opacity-50 flex items-center justify-center gap-2">
            <Camera size={15} /> Capture & clock in
          </button>
        </div>
      </div>
    </div>
  );
};

// ============ MAIN APP ============
// ============ SHIFTS VIEW ============
const ShiftsView = () => {
  const { t } = useT();
  const { user } = useAuth();
  const { can } = useRole();
  const { toast } = useToast();
  const { employees, patch } = useData();
  const { shifts, activeShifts, myShift, clockIn, clockOut, registerClockIn, registerClockOut } = useShifts();
  const [clockOutModal, setClockOutModal] = useState(false);
  const [countedCash, setCountedCash] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [employeeModal, setEmployeeModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const onHandheld = isHandheldUA(navigator.userAgent);

  const isManager = user?.role === 'manager' || user?.role === 'admin';

  const openAddEmployee = () => { setEditingEmployee(null); setEmployeeModal(true); };
  const openEditEmployee = (emp) => { setEditingEmployee(emp); setEmployeeModal(true); };
  const removeEmployee = async (emp) => {
    if (!window.confirm(`Remove "${emp.name}" from the register? This cannot be undone.`)) return;
    try {
      await api.deleteEmployee(emp.id);
      patch('employees', list => list.filter(e => e.id !== emp.id));
      toast('Employee removed');
    } catch (e) {
      toast(!e.status ? "Can't delete while offline — try again once connected" : e.message, 'error');
    }
  };

  const handleCapture = async (photoDataUrl) => {
    setShowCamera(false);
    await clockIn(photoDataUrl);
  };

  const submitClockOut = async () => {
    await clockOut(countedCash === '' ? undefined : Number(countedCash));
    setClockOutModal(false);
    setCountedCash('');
  };

  const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';
  const duration = (a, b) => {
    const end = b ? new Date(b).getTime() : Date.now();
    const ms = end - new Date(a).getTime();
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
  };
  const hoursFor = (a, b) => {
    const end = b ? new Date(b).getTime() : Date.now();
    return (end - new Date(a).getTime()) / 3600000;
  };
  const formatHours = (totalHours) => {
    const h = Math.floor(totalHours);
    const m = Math.round((totalHours - h) * 60);
    return `${h}h ${m}m`;
  };
  const initials = (name) => (name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  // A shift row is either self-service (userId) or a Staff register entry
  // for a roster employee (employeeId) — never both. This key lets the two
  // be aggregated/matched without a user id and an employee id colliding.
  const subjectKey = (s) => s.userId != null ? `u${s.userId}` : `e${s.employeeId}`;

  // History the current person is allowed to see: managers/admins see everyone;
  // a cashier sees only their own shifts.
  const visibleShifts = isManager ? shifts : shifts.filter(s => String(s.userId) === String(user?.id));

  // Total hours worked, summed across every recorded shift (including the
  // one still running, if any) — recomputed on every render straight from
  // the live shifts list, so it updates the moment a clock-out lands without
  // any separate tracking of its own.
  const totalHoursByEmployee = {};
  visibleShifts.forEach(s => {
    const key = subjectKey(s);
    totalHoursByEmployee[key] = (totalHoursByEmployee[key] || 0) + hoursFor(s.clockIn, s.clockOut);
  });
  const myTotalHours = visibleShifts
    .filter(s => String(s.userId) === String(user?.id))
    .reduce((sum, s) => sum + hoursFor(s.clockIn, s.clockOut), 0);

  const exportTimesheet = () => {
    const rows = [[
      'Employee', 'Role', 'Date', 'Clock in', 'Clock out', 'Hours',
      ...(isManager ? ['Expected cash', 'Counted cash', 'Variance'] : []),
      'Status',
    ]];
    visibleShifts.forEach(s => {
      rows.push([
        s.name, s.role,
        new Date(s.clockIn).toISOString().slice(0, 10),
        new Date(s.clockIn).toISOString(),
        s.clockOut ? new Date(s.clockOut).toISOString() : '',
        hoursFor(s.clockIn, s.clockOut).toFixed(2),
        ...(isManager ? [s.expectedCash ?? '', s.countedCash ?? '', s.cashVariance ?? ''] : []),
        s.clockOut ? 'Completed' : 'Active',
      ]);
    });
    downloadCsv(`timesheet-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Your own clock card — everyone sees only this for themselves */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-6">
        <div className="text-[11px] uppercase tracking-widest text-stone-400 font-medium mb-4">Your shift</div>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-rose-500 to-rose-800 flex items-center justify-center text-white text-lg font-semibold shadow-sm">
            {initials(user?.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-medium text-stone-900">{user?.name}</div>
            {myShift ? (
              <div className="text-sm text-emerald-700 flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                On the clock since {fmtTime(myShift.clockIn)} · {duration(myShift.clockIn)}
              </div>
            ) : onHandheld ? (
              <div className="text-sm text-amber-600 mt-0.5">Clock in from the POS terminal — not a phone or tablet</div>
            ) : (
              <div className="text-sm text-stone-400 mt-0.5">You are off the clock</div>
            )}
          </div>
          {myShift ? (
            <button onClick={() => setClockOutModal(true)} className="px-5 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 flex items-center gap-2">
              <ArrowUpLeft size={16} /> Clock out
            </button>
          ) : (
            <button
              onClick={() => user?.role === 'admin' ? clockIn(null) : setShowCamera(true)}
              disabled={onHandheld}
              title={onHandheld ? 'Clock in from the POS terminal — not a phone or tablet' : undefined}
              className="px-5 py-2.5 rounded-xl bg-rose-900 text-white text-sm font-medium hover:bg-rose-800 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-rose-900">
              {user?.role === 'admin' ? <Clock size={16} /> : <Camera size={16} />} Clock in
            </button>
          )}
        </div>
      </div>

      {/* Managers & admins can VIEW who is on duty (read-only — no clocking others) */}
      {isManager && (
        <div className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden">
          <div className="p-5 border-b border-stone-200/80 flex items-center justify-between">
            <h3 className="font-semibold text-stone-900">On duty now</h3>
            <span className="text-xs text-stone-500">{activeShifts.length} on the clock</span>
          </div>
          {activeShifts.length === 0 ? (
            <div className="p-6 text-sm text-stone-400 text-center">Nobody is clocked in right now.</div>
          ) : (
            <div className="divide-y divide-stone-100">
              {activeShifts.map(s => (
                <div key={s.id} className="flex items-center gap-4 p-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold">{initials(s.name)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-stone-900">{s.name}</div>
                    <div className="text-xs text-stone-500 capitalize">{s.role}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-emerald-700 font-medium flex items-center gap-1 justify-end"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Active</div>
                    <div className="text-xs text-stone-500">Since {fmtTime(s.clockIn)} · {duration(s.clockIn)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Staff register — sales-floor staff with no software login at all;
          whoever's logged in (admin/manager/cashier) clocks them in/out.
          Accountant can see it (can.shifts) but not operate it (readOnly). */}
      <div className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden">
        <div className="p-5 border-b border-stone-200/80 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-stone-900">Staff register</h3>
            <p className="text-xs text-stone-500 mt-0.5">Sales floor staff without a software account — clock them in or out here.</p>
          </div>
          {!can.readOnly && (
            <button onClick={openAddEmployee} className="text-xs px-3 py-1.5 rounded-lg bg-rose-900 text-white hover:bg-rose-800 flex items-center gap-1.5">
              <Plus size={13} /> Add employee
            </button>
          )}
        </div>
        {(employees || []).length === 0 ? (
          <div className="p-6 text-sm text-stone-400 text-center">No staff on the register yet.</div>
        ) : (
          <div className="divide-y divide-stone-100">
            {employees.map(emp => {
              const openShift = activeShifts.find(s => String(s.employeeId) === String(emp.id));
              return (
                <div key={emp.id} className="flex items-center gap-4 p-4">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${emp.color || 'from-stone-400 to-stone-600'} flex items-center justify-center text-white text-sm font-semibold flex-shrink-0`}>
                    {emp.initials || initials(emp.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-stone-900">{emp.name}</div>
                    <div className="text-xs text-stone-500">{emp.role}</div>
                  </div>
                  {openShift ? (
                    <div className="flex items-center gap-3">
                      <div className="text-right text-xs">
                        <div className="text-emerald-700 font-medium flex items-center gap-1 justify-end"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> On the clock</div>
                        <div className="text-stone-500">Since {fmtTime(openShift.clockIn)} · {duration(openShift.clockIn)}</div>
                      </div>
                      <button onClick={() => registerClockOut(emp.id)} disabled={can.readOnly}
                        className="px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0">
                        Clock out
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => registerClockIn(emp.id)} disabled={can.readOnly}
                      className="px-3 py-2 rounded-lg bg-rose-900 text-white text-xs font-medium hover:bg-rose-800 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0">
                      Clock in
                    </button>
                  )}
                  {!can.readOnly && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => openEditEmployee(emp)} className="p-1.5 text-stone-400 hover:text-stone-600"><Edit2 size={14} /></button>
                      <button onClick={() => removeEmployee(emp)} className="p-1.5 text-stone-400 hover:text-rose-600"><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Shift history — own for cashiers, everyone for managers/admins */}
      <div className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden">
        <div className="p-5 border-b border-stone-200/80 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-stone-900">{isManager ? 'Shift history' : 'Your shift history'}</h3>
            {!isManager && (
              <p className="text-xs text-stone-500 mt-0.5">Total hours worked: <span className="font-medium text-stone-700">{formatHours(myTotalHours)}</span></p>
            )}
          </div>
          <button onClick={exportTimesheet} className="text-xs px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 flex items-center gap-1.5"><Download size={13} /> Export CSV</button>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-stone-500 bg-stone-50/60">
            <tr>
              {isManager && <th className="text-left font-medium px-5 py-3">Employee</th>}
              {isManager && <th className="text-left font-medium px-5 py-3">Clock-in photo</th>}
              <th className="text-left font-medium px-5 py-3">Date</th>
              <th className="text-left font-medium px-5 py-3">Clock in</th>
              <th className="text-left font-medium px-5 py-3">Clock out</th>
              <th className="text-left font-medium px-5 py-3">Duration</th>
              {isManager && <th className="text-left font-medium px-5 py-3">Cash reconciliation</th>}
              <th className="text-left font-medium px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {visibleShifts.length === 0 ? (
              <tr><td colSpan={isManager ? 8 : 5} className="px-5 py-8 text-center text-stone-400">No shifts recorded yet.</td></tr>
            ) : visibleShifts.map(s => (
              <tr key={s.id}>
                {isManager && (
                  <td className="px-5 py-3">
                    <div className="font-medium text-stone-900">{s.name}</div>
                    <div className="text-xs text-stone-500 capitalize">{s.role}</div>
                    <div className="text-xs text-stone-400 mt-0.5">Total: {formatHours(totalHoursByEmployee[subjectKey(s)] || 0)}</div>
                  </td>
                )}
                {isManager && (
                  <td className="px-5 py-3">
                    {s.clockInPhoto ? (
                      <button onClick={() => window.open(imageUrl(s.clockInPhoto), '_blank')} title="View full size">
                        <img src={imageUrl(s.clockInPhoto)} alt="Clock-in" className="w-10 h-10 rounded-lg object-cover border border-stone-200 hover:opacity-80" />
                      </button>
                    ) : (
                      <span className="text-xs text-stone-400">—</span>
                    )}
                  </td>
                )}
                <td className="px-5 py-3 text-stone-600">{fmtDate(s.clockIn)}</td>
                <td className="px-5 py-3 text-stone-600">{fmtTime(s.clockIn)}</td>
                <td className="px-5 py-3 text-stone-600">{fmtTime(s.clockOut)}</td>
                <td className="px-5 py-3 text-stone-600">{duration(s.clockIn, s.clockOut)}</td>
                {isManager && (
                  <td className="px-5 py-3">
                    {!s.clockOut ? (
                      <span className="text-xs text-stone-400">—</span>
                    ) : s.countedCash == null ? (
                      <span className="text-xs text-stone-400">Not counted</span>
                    ) : (
                      <div className="text-xs">
                        <div className="text-stone-500">Exp. {fmt(s.expectedCash || 0)} · Counted {fmt(s.countedCash)}</div>
                        <div className={`font-medium ${
                          s.cashVariance === 0 ? 'text-emerald-700' : Math.abs(s.cashVariance) <= 500 ? 'text-amber-700' : 'text-rose-700'
                        }`}>
                          {s.cashVariance === 0 ? 'Balanced' : s.cashVariance > 0 ? `Over by ${fmt(s.cashVariance)}` : `Short by ${fmt(Math.abs(s.cashVariance))}`}
                        </div>
                      </div>
                    )}
                  </td>
                )}
                <td className="px-5 py-3">
                  {s.clockOut
                    ? <span className="text-xs px-2 py-1 rounded-full bg-stone-100 text-stone-600">Completed</span>
                    : <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-800">Active</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      <Modal open={clockOutModal} onClose={() => setClockOutModal(false)} title="Clock out — count the drawer"
        footer={<>
          <button onClick={() => { setClockOutModal(false); setCountedCash(''); }} className="px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 rounded-lg">Cancel</button>
          <button onClick={submitClockOut} className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700">Clock out</button>
        </>}>
        <p className="text-sm text-stone-600 mb-3">
          Count the cash currently in the drawer and enter it below. This is compared against your cash sales
          this shift to flag any over/short — leave blank to skip reconciliation.
        </p>
        <Field label="Counted cash (FCFA)">
          <Input type="number" value={countedCash} onChange={(e) => setCountedCash(e.target.value)} placeholder="0" />
        </Field>
      </Modal>

      <ClockInCameraModal open={showCamera} onClose={() => setShowCamera(false)} onCapture={handleCapture} />
      <EmployeeForm open={employeeModal} onClose={() => setEmployeeModal(false)} initial={editingEmployee} />
    </div>
  );
};

export default function DialloPOS() {
  const [lang, setLang] = useState('en');
  const t = (k) => TRANSLATIONS[lang]?.[k] ?? TRANSLATIONS.en[k] ?? k;

  const titles = {
    home: { title: t('home') || 'Home', sub: t('sub_home') },
    pos: { title: t('checkout'), sub: t('sub_pos') },
    dashboard: { title: t('dashboard'), sub: t('sub_dash') },
    inventory: { title: t('inventory'), sub: t('sub_inv') },
    customers: { title: t('customers'), sub: t('sub_cust') },
    reports: { title: t('reports'), sub: t('sub_reports') },
    expenses: { title: t('expenses') || 'Expenses', sub: 'Record and review business expenses' },
    manualSale: { title: t('manualSale') || 'Record Sale', sub: 'Enter a sale that was written down on paper before it reached the system' },
    settings: { title: t('settings'), sub: t('sub_settings') },
    shifts: { title: t('shifts') || 'Shifts', sub: t('sub_shifts') || 'Track employee clock-in and clock-out' },
  };

  const fallback = {
    products: PRODUCTS.map(p => ({ ...p, name_fr: PRODUCT_NAMES_FR[p.id] || '' })),
    customers: CUSTOMERS,
    suppliers: SUPPLIERS,
    purchaseOrders: PURCHASE_ORDERS,
    stockMovements: STOCK_MOVEMENTS,
    users: USERS_DATA,
    employees: DEFAULT_EMPLOYEES,
    shifts: [
      { id: 1, userId: 2, name: 'Mariam Ndongo', role: 'manager', clockIn: new Date(Date.now() - 4 * 3600e3).toISOString(), clockOut: null },
      { id: 2, employeeId: 2, name: 'Awa Sow', role: 'Salesperson', clockIn: new Date(Date.now() - 26 * 3600e3).toISOString(), clockOut: new Date(Date.now() - 18 * 3600e3).toISOString() },
    ],
    settings: {},
    categories: CATEGORIES.filter(c => c.id !== 'all').map(c => ({ id: c.id, label: c.id })),
  };

  return (
    <ToastProvider>
      <PlatformGate>
        <AuthProvider>
          <DataProvider fallback={fallback}>
            <LangContext.Provider value={{ lang, setLang, t }}>
              <RoleProvider>
                <StoreProvider>
                  <ShiftProvider>
                    <AuthGate titles={titles} />
                  </ShiftProvider>
                </StoreProvider>
              </RoleProvider>
            </LangContext.Provider>
          </DataProvider>
        </AuthProvider>
      </PlatformGate>
    </ToastProvider>
  );
}

// Gate #1: which SHOP is this browser using — resolved by the shop
// username+password login (PlatformLogin), separate from and prior to
// AuthGate's staff PIN login below. Nothing under this renders (no
// GET /auth/staff, no DataProvider fetches) until a shop is resolved, since
// none of those calls mean anything without one.
function PlatformGate({ children }) {
  const [resolved, setResolved] = useState(!!getTenantToken());
  if (!resolved) return <PlatformLogin onSuccess={() => setResolved(true)} />;
  return children;
}

// Shows the login screen until a valid session exists, then the app.
function AuthGate({ titles }) {
  const { user, checking } = useAuth();
  const { lang, setLang } = useT();
  const { settings } = useData();
  // The browser tab title is the same kind of shared-code branding leak as
  // the sidebar logo and receipt — must reflect whichever shop is actually
  // logged in, not a hardcoded one.
  useEffect(() => {
    if (settings?.businessName) document.title = `${settings.businessName} — Point of Sale`;
  }, [settings?.businessName]);
  if (checking) {
    return <div className="min-h-screen flex items-center justify-center bg-stone-50 text-stone-400 text-sm">Loading…</div>;
  }
  if (!user) return <LoginScreen lang={lang} setLang={setLang} />;
  return <DialloPOSShell titles={titles} />;
}

// ============ EXPENSES ============
const EXPENSE_CATEGORIES = ['Rent', 'Utilities', 'Salaries', 'Supplies', 'Transport', 'Maintenance', 'Taxes', 'Marketing', 'Other'];

const ExpensesView = () => {
  const { online, queueMutation } = useData();
  const { can } = useRole();
  const { toast } = useToast();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [breakeven, setBreakeven] = useState(null);
  const [monthlyTrend, setMonthlyTrend] = useState([]);
  const today = new Date().toISOString().slice(0, 10);
  const blank = { date: today, category: 'Rent', payee: '', amount: '', method: 'cash', note: '', type: 'operating' };
  const [form, setForm] = useState(blank);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const load = async () => {
    if (!online) return;
    setLoading(true);
    try {
      const [list, be, trend] = await Promise.all([api.getExpenses(), api.breakevenReport(), api.amountLeftTrend(12)]);
      setExpenses(list);
      setBreakeven(be);
      setMonthlyTrend(trend);
    }
    catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [online]); // eslint-disable-line

  const add = async () => {
    if (!form.amount || Number(form.amount) <= 0) { toast('Enter an amount', 'error'); return; }
    const clientId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const payload = { ...form, amount: Number(form.amount), clientId };
    try {
      const saved = await api.createExpense(payload);
      setExpenses(list => [saved, ...list]);
      api.breakevenReport().then(setBreakeven).catch(() => {});
      api.amountLeftTrend(12).then(setMonthlyTrend).catch(() => {});
      toast('Expense recorded');
      setForm({ ...blank, date: form.date, type: form.type });
    } catch (e) {
      if (!e.status) {
        queueMutation('expense', payload);
        setExpenses(list => [{ ...payload, id: Date.now() }, ...list]);
        toast('Offline — expense saved on this device, will sync automatically once back online', 'info');
        setForm({ ...blank, date: form.date });
      } else {
        toast(e.message, 'error');
      }
    }
  };
  const remove = async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    if (!online) { toast("Can't delete while offline — try again once connected", 'error'); return; }
    try {
      await api.deleteExpense(id);
      setExpenses(list => list.filter(x => x.id !== id));
      api.breakevenReport().then(setBreakeven).catch(() => {});
      api.amountLeftTrend(12).then(setMonthlyTrend).catch(() => {});
      toast('Expense deleted');
    } catch (e) { toast(e.message, 'error'); }
  };

  const visibleExpenses = typeFilter === 'all' ? expenses : expenses.filter(e => (e.type || 'operating') === typeFilter);
  const total = visibleExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const exportCsv = () => {
    const rows = [['Date', 'Type', 'Category', 'Payee', 'Amount (FCFA)', 'Method', 'Note', 'Recorded by']];
    visibleExpenses.forEach(e => rows.push([e.date, e.type === 'setup' ? 'Setup' : 'Operating', e.category, e.payee, e.amount, e.method, e.note, e.createdBy || '']));
    rows.push([]); rows.push(['', '', '', 'TOTAL', total]);
    downloadCsv(`expenses-${today}.csv`, rows);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-stone-50/30 p-5 md:p-7">
      {breakeven && (
        <div className={`rounded-2xl p-5 border mb-5 ${breakeven.amountLeft >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className={`text-xs font-medium ${breakeven.amountLeft >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>Amount left after expenses · all-time</p>
              <p className={`font-serif text-3xl ${breakeven.amountLeft >= 0 ? 'text-emerald-900' : 'text-rose-900'}`} style={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}>
                {fmt(breakeven.amountLeft)}
              </p>
            </div>
            <div className={`text-xs space-y-0.5 ${breakeven.amountLeft >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              <div className="flex justify-between gap-4"><span>Total sales</span><span className="font-medium">{fmt(breakeven.allTimeRevenue)}</span></div>
              <div className="flex justify-between gap-4"><span>− Total expenses</span><span className="font-medium">{fmt(breakeven.allTimeExpenses)}</span></div>
            </div>
          </div>
        </div>
      )}

      {monthlyTrend.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden mb-5">
          <div className="p-5 border-b border-stone-200/80">
            <h3 className="font-semibold text-stone-900">Amount left after expenses · by month</h3>
            <p className="text-xs text-stone-500 mt-0.5">Last {monthlyTrend.length} months</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-stone-500 bg-stone-50/60">
                <tr>
                  <th className="text-left font-medium px-5 py-3">Month</th>
                  <th className="text-right font-medium px-5 py-3">Sales</th>
                  <th className="text-right font-medium px-5 py-3">Expenses</th>
                  <th className="text-right font-medium px-5 py-3">Amount left</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {monthlyTrend.map(m => (
                  <tr key={m.month}>
                    <td className="px-5 py-3 font-medium text-stone-900">{m.month}</td>
                    <td className="px-5 py-3 text-right text-stone-600">{fmt(m.revenue)}</td>
                    <td className="px-5 py-3 text-right text-stone-600">{fmt(m.expenses)}</td>
                    <td className={`px-5 py-3 text-right font-medium ${m.amountLeft >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{fmt(m.amountLeft)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {can.expenses && (
        <div className="bg-white rounded-2xl p-5 border border-stone-200/80 mb-5">
          <h3 className="font-serif text-lg text-stone-900 mb-4" style={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}>Record an expense</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            <div><label className="block text-[11px] text-stone-500 mb-1">Date</label>
              <input type="date" value={form.date} max={today} onChange={set('date')} className="w-full px-2.5 py-2 border border-stone-200 rounded-lg text-sm" /></div>
            <div><label className="block text-[11px] text-stone-500 mb-1">Type</label>
              <select value={form.type} onChange={set('type')} className="w-full px-2.5 py-2 border border-stone-200 rounded-lg text-sm">
                <option value="operating">Operating</option><option value="setup">Setup (one-time)</option>
              </select></div>
            <div><label className="block text-[11px] text-stone-500 mb-1">Category</label>
              <select value={form.category} onChange={set('category')} className="w-full px-2.5 py-2 border border-stone-200 rounded-lg text-sm">
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select></div>
            <div><label className="block text-[11px] text-stone-500 mb-1">Payee</label>
              <input value={form.payee} onChange={set('payee')} placeholder="Who paid" className="w-full px-2.5 py-2 border border-stone-200 rounded-lg text-sm" /></div>
            <div><label className="block text-[11px] text-stone-500 mb-1">Amount (FCFA)</label>
              <input type="number" value={form.amount} onChange={set('amount')} placeholder="0" className="w-full px-2.5 py-2 border border-stone-200 rounded-lg text-sm" /></div>
            <div><label className="block text-[11px] text-stone-500 mb-1">Method</label>
              <select value={form.method} onChange={set('method')} className="w-full px-2.5 py-2 border border-stone-200 rounded-lg text-sm">
                <option value="cash">Cash</option><option value="mobile">Mobile money</option><option value="bank">Bank</option>
              </select></div>
            <div className="flex items-end"><button onClick={add} className="w-full px-3 py-2 rounded-lg bg-rose-900 text-white text-sm font-medium hover:bg-rose-800">Add</button></div>
          </div>
          <div className="mt-3"><label className="block text-[11px] text-stone-500 mb-1">Note (optional)</label>
            <input value={form.note} onChange={set('note')} placeholder="Description" className="w-full px-2.5 py-2 border border-stone-200 rounded-lg text-sm" /></div>
          {form.type === 'setup' && (
            <p className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Setup expenses are one-time, pre-opening costs you're trying to recoup — e.g. registration, legal fees, renovation labor.
              <strong> Don't include anything you still own and could resell</strong> (equipment, vehicles, furniture, property) — those are assets, not sunk costs, and belong under "Operating" or not recorded as an expense at all.
            </p>
          )}
        </div>
      )}

      {breakeven && breakeven.setupCost > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-stone-200/80 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-stone-900">Break-even on setup costs</h3>
            {breakeven.brokenEven
              ? <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-medium">Broken even</span>
              : <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-medium">Not yet broken even</span>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-3">
            <div><p className="text-xs text-stone-500">Total setup cost</p><p className="font-semibold text-stone-900">{fmt(breakeven.setupCost)}</p></div>
            <div><p className="text-xs text-stone-500">Cumulative net profit</p><p className="font-semibold text-stone-900">{fmt(breakeven.cumulativeNetProfit)}</p></div>
            <div><p className="text-xs text-stone-500">Remaining to break even</p><p className="font-semibold text-rose-700">{fmt(breakeven.remaining)}</p></div>
            <div><p className="text-xs text-stone-500">Recovered</p><p className="font-semibold text-stone-900">{breakeven.pctRecovered}%</p></div>
          </div>
          <div className="w-full h-2 rounded-full bg-stone-100 overflow-hidden">
            <div className="h-full bg-emerald-700" style={{ width: `${breakeven.pctRecovered}%` }} />
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden">
        <div className="p-5 border-b border-stone-200/80 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-stone-900">Expenses</h3>
            <p className="text-xs text-stone-500 mt-0.5">Total recorded: <span className="font-medium text-rose-700">{fmt(total)}</span></p>
          </div>
          <div className="flex items-center gap-2">
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="text-xs px-2.5 py-1.5 border border-stone-200 rounded-lg">
              <option value="all">All types</option>
              <option value="operating">Operating only</option>
              <option value="setup">Setup only</option>
            </select>
            <button onClick={exportCsv} className="text-xs px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 flex items-center gap-1.5"><Download size={13} /> Export CSV</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-stone-500 bg-stone-50/60">
              <tr>
                <th className="text-left font-medium px-5 py-3">Date</th>
                <th className="text-left font-medium px-5 py-3">Type</th>
                <th className="text-left font-medium px-5 py-3">Category</th>
                <th className="text-left font-medium px-5 py-3">Payee</th>
                <th className="text-left font-medium px-5 py-3">Method</th>
                <th className="text-right font-medium px-5 py-3">Amount</th>
                {can.expenses && <th className="px-5 py-3"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {visibleExpenses.length === 0 ? (
                <tr><td colSpan={can.expenses ? 7 : 6} className="px-5 py-8 text-center text-stone-400">{loading ? 'Loading…' : 'No expenses recorded yet.'}</td></tr>
              ) : visibleExpenses.map(e => (
                <tr key={e.id}>
                  <td className="px-5 py-3 text-stone-600">{e.date}</td>
                  <td className="px-5 py-3">
                    {e.type === 'setup'
                      ? <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800">Setup</span>
                      : <span className="text-xs px-2 py-1 rounded-full bg-stone-100 text-stone-600">Operating</span>}
                  </td>
                  <td className="px-5 py-3"><span className="text-xs px-2 py-1 rounded-full bg-stone-100 text-stone-700">{e.category}</span></td>
                  <td className="px-5 py-3 text-stone-700">{e.payee || '—'}{e.note ? <span className="block text-xs text-stone-400">{e.note}</span> : null}</td>
                  <td className="px-5 py-3 text-stone-600 capitalize">{e.method}</td>
                  <td className="px-5 py-3 text-right font-medium text-stone-900">{fmt(e.amount)}</td>
                  {can.expenses && <td className="px-5 py-3 text-right"><button onClick={() => remove(e.id)} className="text-xs text-stone-400 hover:text-rose-600">Delete</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// For a sale that happened and was written down on paper (the books) at the
// time, only reaching the system later — e.g. at day's end or the next
// morning. Unlike checkout (POSView), the person entering it picks the date
// it actually occurred rather than using "now", and the sale is flagged so
// it's excluded from any cashier's cash-drawer reconciliation (no real cash
// moved through today's till for it). Admin/manager only — see
// ROLE_ACCESS.manualSale.
const ManualSaleView = () => {
  const { lang } = useT();
  const { online, products: liveProducts, customers: liveCustomers, refresh } = useData();
  const { toast } = useToast();
  const products = online ? (liveProducts || []) : (liveProducts?.length ? liveProducts : PRODUCTS);
  const customerList = online ? (liveCustomers || []) : (liveCustomers?.length ? liveCustomers : CUSTOMERS);
  const today = new Date().toISOString().slice(0, 10);
  const productName = (p) => lang === 'fr' ? (p.name_fr || PRODUCT_NAMES_FR[p.id] || p.name) : p.name;

  const [date, setDate] = useState(today);
  const [method, setMethod] = useState('cash');
  const [customerId, setCustomerId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [cart, setCart] = useState([]); // { id, name, sku, price, qty }
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [recent, setRecent] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  const loadRecent = async () => {
    if (!online) return;
    setLoadingRecent(true);
    try { setRecent(await api.getManualOrders()); }
    catch (e) { toast(e.message, 'error'); }
    finally { setLoadingRecent(false); }
  };
  useEffect(() => { loadRecent(); }, [online]); // eslint-disable-line

  const matches = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return products.filter(p =>
      productName(p).toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)
    ).slice(0, 8);
  }, [search, products, lang]); // eslint-disable-line

  const addProduct = (p) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === p.id);
      if (ex) return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: p.id, name: productName(p), sku: p.sku, price: p.price, qty: 1 }];
    });
    setSearch('');
  };
  const updateCartQty = (id, qty) => setCart(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(1, Math.round(Number(qty) || 1)) } : i));
  const updateCartPrice = (id, price) => setCart(prev => prev.map(i => i.id === id ? { ...i, price: Math.max(0, Number(price) || 0) } : i));
  const removeCartItem = (id) => setCart(prev => prev.filter(i => i.id !== id));

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discountAmt = Math.min(Number(discount) || 0, subtotal);
  const discountedBase = subtotal - discountAmt;
  // TVA (VAT) has been removed — see the matching note in POSView.
  const total = discountedBase;

  const submit = async () => {
    if (!date) { toast('Pick a date', 'error'); return; }
    if (date > today) { toast('Date cannot be in the future', 'error'); return; }
    if (!cart.length) { toast('Add at least one item', 'error'); return; }
    setSaving(true);
    try {
      const clientOrderId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await api.createManualOrder({
        items: cart.map(({ id, name, sku, price, qty }) => ({ id, name, sku, price, qty, mode: 'unit' })),
        customerId: customerId ? Number(customerId) : null,
        method, discount: discountAmt, tva: 0, date, clientOrderId,
      });
      toast('Sale recorded');
      setCart([]); setDiscount(0); setCustomerId('');
      refresh(); // stock levels changed
      loadRecent();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-stone-50/30 p-5 md:p-7">
      <div className="bg-white rounded-2xl p-5 border border-stone-200/80 mb-5">
        <h3 className="font-serif text-lg text-stone-900 mb-1" style={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}>Record a sale from the books</h3>
        <p className="text-xs text-stone-500 mb-4">For a sale written down on paper when it happened and only now being entered. It's dated to when it actually occurred and won't count toward any cashier's cash-drawer reconciliation.</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div><label className="block text-[11px] text-stone-500 mb-1">Date of sale</label>
            <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className="w-full px-2.5 py-2 border border-stone-200 rounded-lg text-sm" /></div>
          <div><label className="block text-[11px] text-stone-500 mb-1">Payment method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full px-2.5 py-2 border border-stone-200 rounded-lg text-sm">
              <option value="cash">Cash</option><option value="mobile">Mobile money</option><option value="bank">Bank</option>
            </select></div>
          <div><label className="block text-[11px] text-stone-500 mb-1">Customer (optional)</label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="w-full px-2.5 py-2 border border-stone-200 rounded-lg text-sm">
              <option value="">Walk-in</option>
              {customerList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
          <div><label className="block text-[11px] text-stone-500 mb-1">Discount (FCFA)</label>
            <input type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} className="w-full px-2.5 py-2 border border-stone-200 rounded-lg text-sm" /></div>
        </div>

        <div className="relative mb-3">
          <label className="block text-[11px] text-stone-500 mb-1">Add item</label>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product by name or SKU"
              className="w-full pl-8 pr-2.5 py-2 border border-stone-200 rounded-lg text-sm" />
          </div>
          {matches.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-stone-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
              {matches.map(p => (
                <button key={p.id} onClick={() => addProduct(p)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-stone-50 text-left">
                  <span className="text-stone-800">{productName(p)}</span>
                  <span className="text-stone-400 text-xs">{fmt(p.price)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="border border-stone-200 rounded-lg overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead className="text-xs text-stone-500 bg-stone-50/60">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Item</th>
                  <th className="text-right font-medium px-3 py-2 w-24">Qty</th>
                  <th className="text-right font-medium px-3 py-2 w-28">Price</th>
                  <th className="text-right font-medium px-3 py-2 w-28">Line total</th>
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {cart.map(i => (
                  <tr key={i.id}>
                    <td className="px-3 py-2 text-stone-700">{i.name}</td>
                    <td className="px-3 py-2 text-right">
                      <input type="number" min="1" value={i.qty} onChange={(e) => updateCartQty(i.id, e.target.value)}
                        className="w-16 px-2 py-1 border border-stone-200 rounded text-right text-sm" />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input type="number" min="0" value={i.price} onChange={(e) => updateCartPrice(i.id, e.target.value)}
                        className="w-20 px-2 py-1 border border-stone-200 rounded text-right text-sm" />
                    </td>
                    <td className="px-3 py-2 text-right text-stone-900 font-medium">{fmt(i.price * i.qty)}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => removeCartItem(i.id)} className="text-stone-400 hover:text-rose-600"><X size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="text-sm space-y-1">
            <div className="flex gap-4 text-stone-600"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
            {discountAmt > 0 && <div className="flex gap-4 text-stone-600"><span>Discount</span><span>-{fmt(discountAmt)}</span></div>}
            <div className="flex gap-4 text-stone-900 font-semibold text-base pt-1"><span>Total</span><span>{fmt(total)}</span></div>
          </div>
          <button onClick={submit} disabled={saving || !cart.length}
            className="px-5 py-2.5 rounded-lg bg-rose-900 text-white text-sm font-medium hover:bg-rose-800 disabled:opacity-50">
            {saving ? 'Recording…' : 'Record sale'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden">
        <div className="p-5 border-b border-stone-200/80">
          <h3 className="font-semibold text-stone-900">Recently recorded</h3>
          <p className="text-xs text-stone-500 mt-0.5">Sales entered from the books here, most recently entered first.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-stone-500 bg-stone-50/60">
              <tr>
                <th className="text-left font-medium px-5 py-3">Sale date</th>
                <th className="text-left font-medium px-5 py-3">Invoice</th>
                <th className="text-left font-medium px-5 py-3">Recorded by</th>
                <th className="text-left font-medium px-5 py-3">Method</th>
                <th className="text-right font-medium px-5 py-3">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {recent.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-stone-400">{loadingRecent ? 'Loading…' : 'No manual sales recorded yet.'}</td></tr>
              ) : recent.map(o => (
                <tr key={o.id}>
                  <td className="px-5 py-3 text-stone-600">{(o.createdAt || '').slice(0, 10)}</td>
                  <td className="px-5 py-3 text-stone-700">{o.invoiceNo}</td>
                  <td className="px-5 py-3 text-stone-600">{o.cashier || '—'}</td>
                  <td className="px-5 py-3 text-stone-600 capitalize">{o.method}</td>
                  <td className="px-5 py-3 text-right font-medium text-stone-900">{fmt(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

function DialloPOSShell({ titles }) {
  const { can } = useRole();
  const { lang } = useT();
  const { online, products: liveProducts, customers: liveCustomers, settings } = useData();
  const products = online ? (liveProducts || []) : (liveProducts?.length ? liveProducts : PRODUCTS);
  const customers = online ? (liveCustomers || []) : (liveCustomers?.length ? liveCustomers : CUSTOMERS);
  const lowStockThreshold = Number(settings?.lowStockThreshold) || 10;
  // Shifts is excluded here on a phone/tablet, same as the nav item itself —
  // there's no URL-based routing in this app, so keeping both this default
  // and the nav filter in sync is what actually makes the view unreachable.
  const onHandheld = isHandheldUA(navigator.userAgent);
  const firstView = (c) => ['home', 'pos', 'dashboard', 'inventory', 'reports', 'expenses', 'customers', 'shifts']
    .find(k => c[k] && (k !== 'shifts' || !onHandheld)) || (onHandheld ? 'pos' : 'shifts');
  const [view, setView] = useState(() => firstView(can));
  // If the current role loses access to the active view (or it's Shifts on a
  // handheld device), fall back to its first allowed view.
  React.useEffect(() => { if (!can[view] || (view === 'shifts' && onHandheld)) setView(firstView(can)); }, [can, view]);
  const go = (v) => setView(v);

  const guarded = (key, label, El) => can[key] ? <El /> : <AccessDenied feature={label} />;

  // These three subtitles quote live counts in the static translation strings — replace
  // them with the real numbers instead of letting the demo figures show forever.
  const lowStockCount = products.filter(p => p.stock < lowStockThreshold).length;
  const loyaltyCount = customers.filter(c => c.tier && c.tier !== 'Bronze').length;
  const dynamicSub = {
    inventory: lang === 'fr'
      ? `${products.length} produits · ${lowStockCount} alertes`
      : `${products.length} products · ${lowStockCount} alerts`,
    customers: lang === 'fr'
      ? `${customers.length} clients · ${loyaltyCount} membres fidélité`
      : `${customers.length} customers · ${loyaltyCount} loyalty members`,
  };
  const subtitleFor = (v) => dynamicSub[v] ?? titles[v].sub;

  return (
    <div className="h-screen w-full flex bg-stone-100 text-stone-900 relative overflow-hidden" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        * { -webkit-font-smoothing: antialiased; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d6d3d1; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #a8a29e; }
      `}</style>

      {/* Global discount approval modal — visible to admin/manager on any page */}
      <DiscountApprovalWatcher />
      <ReturnApprovalWatcher />

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title={titles[view].title} subtitle={subtitleFor(view)} onHome={() => go('home')} onSettings={() => go('settings')} showHome={view !== 'home'} />
        {view === 'home' && (can.home ? (
          <HomeView onNavigate={go} />
        ) : <AccessDenied feature="Home" />)}
        {view === 'pos' && (can.pos ? (
          <POSView />
        ) : <AccessDenied feature="Checkout" />)}
        {view === 'dashboard' && guarded('dashboard', 'Dashboard & Financials', DashboardView)}
        {view === 'inventory' && guarded('inventory', 'Inventory', InventoryView)}
        {view === 'customers' && guarded('customers', 'Customers', CustomersView)}
        {view === 'reports' && guarded('reports', 'Reports', ReportsView)}
        {view === 'expenses' && guarded('expenses', 'Expenses', ExpensesView)}
        {view === 'manualSale' && guarded('manualSale', 'Record Sale', ManualSaleView)}
        {view === 'settings' && guarded('settings', 'Settings & Users', SettingsView)}
        {view === 'shifts' && <ShiftsView />}
      </div>
    </div>
  );
}
