import React, { useState, useEffect } from 'react';
import { Building2, Link as LinkIcon, CheckCircle2, ShieldAlert, Send, Laptop, ArrowLeft, ChevronRight, CreditCard, Wifi, ShieldCheck, Settings, Mail, MessageCircle, Plus, Trash2 } from 'lucide-react';

// --- Global Data Models ---
const ROLE_BANDS = [
  "Executive/Senior Management",
  "Managers/Professional Staff",
  "Field Teams / Supervisors",
  "General Staff",
  "Training/Departments"
];

const CONNECTIVITY_CATEGORIES = [
  "Category 1: Device + Plan (SIM/eSIM, data, minutes)",
  "Category 2: Device Only"
];

const NETWORKS = ["Safaricom", "Airtel", "Jamii Telecom"];

const WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbyz13q76b8CIfo6iaDdwrhx20Ym_5Cs7I8nFTTtWBAOt49jG78S_vyCBsxKbioOeUeKUw/exec';

// Unified Catalog merging devices, prices, and their role access rights
const INITIAL_CATALOG = [
  { id: 'a07_4', name: 'Samsung Galaxy A07 (4GB/64GB)', price: 22120, roles: ["General Staff"] },
  { id: 'a07_6', name: 'Samsung Galaxy A07 (6GB/128GB)', price: 25794, roles: ["General Staff"] },
  { id: 'a17_4', name: 'Samsung Galaxy A17 (4GB/128GB)', price: 35347, roles: ["General Staff"] },
  { id: 'a17_6', name: 'Samsung Galaxy A17 (6GB/128GB)', price: 38287, roles: ["General Staff"] },
  { id: 'a26_6', name: 'Samsung Galaxy A26 (6GB/128GB)', price: 52214, roles: ["Managers/Professional Staff", "Field Teams / Supervisors"] },
  { id: 'a26_12', name: 'Samsung Galaxy A26 (12GB/256GB)', price: 71401, roles: ["Managers/Professional Staff", "Field Teams / Supervisors"] },
  { id: 'a57_8', name: 'Samsung Galaxy A57 (8GB/256GB)', price: 104740, roles: ["Managers/Professional Staff"] },
  { id: 's26_12', name: 'Samsung Galaxy S26 (12GB/256GB)', price: 185034, roles: ["Executive/Senior Management"] },
  { id: 's26p_256', name: 'Samsung Galaxy S26 Pro (12GB/256GB)', price: 220551, roles: ["Executive/Senior Management"] },
  { id: 's26p_512', name: 'Samsung Galaxy S26 Pro (12GB/512GB)', price: 259742, roles: ["Executive/Senior Management"] },
  { id: 's26u_256', name: 'Samsung Galaxy S26 Ultra (12GB/256GB)', price: 171355, roles: ["Executive/Senior Management"] },
  { id: 's26u_512', name: 'Samsung Galaxy S26 Ultra (12GB/512GB)', price: 296973, roles: ["Executive/Senior Management"] },
  { id: 't11_6', name: 'Samsung Tab 11 Plus (6GB/128GB)', price: 43213, roles: ["Managers/Professional Staff", "Training/Departments"] },
  { id: 't11_8', name: 'Samsung Tab 11 Plus (8GB/128GB)', price: 51241, roles: ["Managers/Professional Staff", "Training/Departments"] },
  { id: 't10fe_6', name: 'Samsung Tab S10 FE Lite (6GB/128GB)', price: 64169, roles: ["Managers/Professional Staff", "Field Teams / Supervisors", "Training/Departments"] },
  { id: 't10fe_8', name: 'Samsung Tab S10 FE Lite (8GB/128GB)', price: 76144, roles: ["Managers/Professional Staff", "Field Teams / Supervisors", "Training/Departments"] },
  { id: 'tu_256', name: 'Samsung Tab Ultra (12GB/256GB)', price: 201636, roles: ["Executive/Senior Management", "Training/Departments"] },
  { id: 'tu_512', name: 'Samsung Tab Ultra (12GB/512GB)', price: 229532, roles: ["Executive/Senior Management", "Training/Departments"] },
  { id: 'wad_65', name: 'Samsung WAD Series Board 65"', price: 320984, roles: ["Training/Departments"] },
  { id: 'wad_75', name: 'Samsung WAD Series Board 75"', price: 361808, roles: ["Training/Departments"] },
  { id: 'wad_86', name: 'Samsung WAD Series Board 86"', price: 443456, roles: ["Training/Departments"] }
];

// Utilities to securely compress the catalog into the URL string and uncompress it
const packCatalog = (catalog) => {
  const packed = catalog.map(d => ({
    i: d.id, n: d.name, p: d.price, r: d.roles.map(role => ROLE_BANDS.indexOf(role))
  }));
  return btoa(encodeURIComponent(JSON.stringify(packed)));
};

const unpackCatalog = (packedStr) => {
  try {
    const packed = JSON.parse(decodeURIComponent(atob(packedStr)));
    return packed.map(d => ({
      id: d.i, name: d.n, price: d.p, roles: d.r.map(idx => ROLE_BANDS[idx]).filter(Boolean)
    }));
  } catch (e) {
    console.error("Failed to parse custom config", e);
    return INITIAL_CATALOG;
  }
};


export default function App() {
  // Check if this is an actual generated link shared with an employee
  const isEmployeeLink = new URLSearchParams(window.location.search).has('company');

  // --- Initializing App State from URL ---
  const getInitialView = () => isEmployeeLink ? 'survey' : 'admin';
  const getInitialCompany = () => new URLSearchParams(window.location.search).get('company') || '';
  
  // Initialize the catalog (custom from URL if it exists, otherwise default)
  const [activeCatalog, setActiveCatalog] = useState(() => {
    const cfg = new URLSearchParams(window.location.search).get('cfg');
    return cfg ? unpackCatalog(cfg) : INITIAL_CATALOG;
  });

  const [currentView, setCurrentView] = useState(getInitialView());
  const [targetCompany, setTargetCompany] = useState(getInitialCompany());

  // --- Admin State ---
  const [adminForm, setAdminForm] = useState({ companyName: '', contactPerson: '', contactEmail: '', contactPhone: '' });
  const [adminCatalog, setAdminCatalog] = useState([...INITIAL_CATALOG]);
  const [generatedLink, setGeneratedLink] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  // --- Survey State ---
  const [surveyForm, setSurveyForm] = useState({
    employeeName: '',
    roleTier: '',
    selectedDeviceId: '',
    category: '',
    network: '',
    payrollConsent: false
  });
  const [surveyStatus, setSurveyStatus] = useState('idle');

  // --- Handlers: Admin Catalog Management ---
  const handleAdminChange = (e) => setAdminForm({ ...adminForm, [e.target.name]: e.target.value });
  
  const handleCatalogUpdate = (id, field, value) => {
    setAdminCatalog(prev => prev.map(dev => dev.id === id ? { ...dev, [field]: value } : dev));
  };

  const handleToggleRole = (id, role) => {
    setAdminCatalog(prev => prev.map(dev => {
      if (dev.id === id) {
        const roles = dev.roles.includes(role) ? dev.roles.filter(r => r !== role) : [...dev.roles, role];
        return { ...dev, roles };
      }
      return dev;
    }));
  };

  const handleDeleteDevice = (id) => {
    setAdminCatalog(prev => prev.filter(dev => dev.id !== id));
  };

  const handleAddDevice = () => {
    const newId = 'dev_' + Date.now().toString(36);
    setAdminCatalog([{ id: newId, name: 'New Custom Device', price: 0, roles: [] }, ...adminCatalog]);
  };

  // --- Handlers: Survey & Output ---
  const handleSurveyChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setSurveyForm({ ...surveyForm, [e.target.name]: value });
    
    if (e.target.name === 'roleTier') setSurveyForm(prev => ({ ...prev, selectedDeviceId: '' }));
    if (e.target.name === 'category') setSurveyForm(prev => ({ ...prev, network: '' }));
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(price);
  };

  const handleOnboardCompany = async (e) => {
    e.preventDefault();
    setIsGenerating(true);

    const baseUrl = window.location.origin + window.location.pathname;
    const safeCompanyId = encodeURIComponent(adminForm.companyName);
    
    // Create the compressed parameter only if changes were made
    const defaultCfgStr = packCatalog(INITIAL_CATALOG);
    const customCfgStr = packCatalog(adminCatalog);
    const cfgParam = (customCfgStr !== defaultCfgStr) ? `&cfg=${customCfgStr}` : '';
    
    const link = `${baseUrl}?company=${safeCompanyId}${cfgParam}`;

    const payload = {
      action: "onboardCompany",
      companyName: adminForm.companyName,
      contactPerson: adminForm.contactPerson,
      contactEmail: adminForm.contactEmail,
      contactPhone: adminForm.contactPhone,
      webAppBaseUrl: baseUrl,
      surveyLink: link
    };

    try {
      await fetch(WEBHOOK_URL, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      });
    } catch (err) {
      console.error("Webhook submission failed", err);
    }

    setTimeout(() => {
      setGeneratedLink(link);
      setActiveCatalog(adminCatalog); // Ensure preview uses the custom admin config
      setIsGenerating(false);
    }, 1200); 
  };

  const handleSubmitSurvey = async (e) => {
    e.preventDefault();
    setSurveyStatus('submitting');

    const selectedDeviceObj = activeCatalog.find(d => d.id === surveyForm.selectedDeviceId);
    const finalPrice = formatPrice(selectedDeviceObj.price);

    const payload = {
      action: "submitSurvey",
      companyName: targetCompany || "Demo Company",
      employeeName: surveyForm.employeeName,
      roleTier: surveyForm.roleTier,
      selectedDevice: selectedDeviceObj ? selectedDeviceObj.name : 'Unknown Device',
      category: surveyForm.category,
      network: surveyForm.category.includes('Category 1') ? surveyForm.network : 'N/A',
      price: finalPrice, 
      payrollConsent: surveyForm.payrollConsent
    };

    try {
      await fetch(WEBHOOK_URL, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      });
    } catch (err) {
      console.error("Webhook submission error.", err);
    }

    setTimeout(() => {
      setSurveyStatus('success');
    }, 1500);
  };

  const previewSurvey = () => {
    if (!adminForm.companyName) {
      alert("Please enter a company name first to preview their survey.");
      return;
    }
    setTargetCompany(adminForm.companyName);
    setCurrentView('survey');
  };

  const getMailtoLink = () => {
    const subject = encodeURIComponent(`TEP Connect Staff Device Program - ${adminForm.companyName}`);
    const body = encodeURIComponent(`Dear ${adminForm.contactPerson || 'Team'},\n\nAs agreed, please find the staff device interest survey link below.\n\nWe kindly request you to share this with all eligible staff at your convenience:\n\n${generatedLink}\n\nThank you for partnering with us on this initiative.\n\nBest regards,\nTEP Connect Administrator`);
    return `mailto:${adminForm.contactEmail}?subject=${subject}&body=${body}`;
  };

  const getWhatsAppLink = () => {
    let phone = adminForm.contactPhone.replace(/\D/g, ''); 
    if (phone.startsWith('0')) phone = '254' + phone.substring(1);
    else if (phone.startsWith('7') || phone.startsWith('1')) phone = '254' + phone;
    
    const text = encodeURIComponent(`Dear ${adminForm.contactPerson || 'Team'},\n\nAs agreed, please find the staff device interest survey link below.\n\nWe kindly request you to share this with all eligible staff at your convenience:\n\n${generatedLink}\n\nThank you for partnering with us on this initiative.\n\nBest regards,\nTEP Connect Administrator`);
    return `https://wa.me/${phone}?text=${text}`;
  };

  // Derived variable for the dropdown options based on the currently selected role
  const availableDevices = activeCatalog.filter(d => d.roles.includes(surveyForm.roleTier));

  // --- Views ---
  const renderAdminView = () => (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-12">
      
      <div className="text-center mb-10">
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Partner Onboarding</h2>
        <p className="text-slate-500 mt-2 text-lg">Generate tailored deployment infrastructure for corporate clients.</p>
      </div>

      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden">
        
        <div className="p-8 md:p-10">
          
          <form onSubmit={handleOnboardCompany} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Company Name *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Building2 className="h-5 w-5 text-slate-400" />
                  </div>
                  <input 
                    required type="text" name="companyName" value={adminForm.companyName} onChange={handleAdminChange}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-800 shadow-sm"
                    placeholder="e.g. Safaricom PLC"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Contact Person</label>
                <input 
                  type="text" name="contactPerson" value={adminForm.contactPerson} onChange={handleAdminChange}
                  className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-800 shadow-sm"
                  placeholder="e.g. Jane Doe, HR Director"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">WhatsApp Number (Optional)</label>
                <input 
                  type="tel" name="contactPhone" value={adminForm.contactPhone} onChange={handleAdminChange}
                  className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-slate-800 shadow-sm"
                  placeholder="e.g. 0712345678"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Contact Email *</label>
                <input 
                  required type="email" name="contactEmail" value={adminForm.contactEmail} onChange={handleAdminChange}
                  className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-800 shadow-sm"
                  placeholder="contact@company.com"
                />
              </div>
            </div>

            {/* Advanced Configuration Accordion */}
            <div className="mt-8 pt-6 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowConfig(!showConfig)}
                className="flex items-center gap-2 text-indigo-600 font-bold text-sm hover:text-indigo-800 transition-colors"
              >
                <Settings size={18} className={showConfig ? "rotate-90 transition-transform" : "transition-transform"} />
                {showConfig ? "Hide Hardware & Pricing Configurator" : "Configure Custom Catalog & Roles (Optional)"}
              </button>

              {showConfig && (
                <div className="mt-6 bg-slate-50 border border-slate-200 rounded-2xl p-6 animate-fade-in">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-sm text-slate-500 leading-relaxed max-w-xl">
                      Add, remove, or modify devices, pricing, and role-based access for this specific client. Modifications are embedded securely into their deployment link.
                    </p>
                  </div>

                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar pb-2">
                    {adminCatalog.map((device, index) => (
                      <div key={device.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-indigo-300 transition-colors relative group">
                        
                        <div className="flex flex-col sm:flex-row gap-4 mb-4">
                          <div className="flex-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Device Name</label>
                            <input
                              type="text"
                              value={device.name}
                              onChange={e => handleCatalogUpdate(device.id, 'name', e.target.value)}
                              className="w-full font-semibold text-slate-800 bg-transparent border-b-2 border-transparent hover:border-slate-200 focus:border-indigo-500 outline-none pb-1 mt-1 transition-colors"
                              placeholder="e.g. Samsung Galaxy S26"
                            />
                          </div>
                          
                          <div className="w-full sm:w-32 shrink-0 relative">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Price (Ksh)</label>
                            <input
                              type="number"
                              value={device.price}
                              onChange={e => handleCatalogUpdate(device.id, 'price', parseInt(e.target.value) || 0)}
                              className="w-full font-semibold text-slate-800 bg-transparent border-b-2 border-transparent hover:border-slate-200 focus:border-indigo-500 outline-none pb-1 mt-1 transition-colors"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Available To These Roles</label>
                          <div className="flex flex-wrap gap-2">
                            {ROLE_BANDS.map(role => {
                              const isActive = device.roles.includes(role);
                              // Shorten the display name of the role for the badges (e.g., "Executive/Senior Management" -> "Executive")
                              const shortRole = role.split('/')[0];
                              return (
                                <button
                                  key={role}
                                  type="button"
                                  onClick={() => handleToggleRole(device.id, role)}
                                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                                    isActive
                                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold shadow-sm'
                                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 font-medium'
                                  }`}
                                  title={`Toggle access for ${role}`}
                                >
                                  {shortRole}
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteDevice(device.id)}
                          className="absolute top-4 right-4 text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                          title="Remove Device"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleAddDevice}
                    className="mt-4 flex items-center justify-center gap-2 w-full py-4 border-2 border-dashed border-indigo-200 text-indigo-600 rounded-xl hover:bg-indigo-50 hover:border-indigo-300 transition-colors font-bold shadow-sm"
                  >
                    <Plus size={20} /> Add Custom Device
                  </button>
                </div>
              )}
            </div>

            <div className="pt-4">
              <button 
                type="submit" 
                disabled={isGenerating}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-4 px-6 rounded-xl flex justify-center items-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                {isGenerating ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Provisioning Infrastructure...
                  </span>
                ) : (
                  <>Generate Deployment Link <ChevronRight size={18} /></>
                )}
              </button>
            </div>
          </form>

          {generatedLink && (
            <div className="mt-10 p-6 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl animate-fade-in shadow-sm">
              <h3 className="text-lg font-bold text-emerald-900 flex items-center gap-2 mb-2">
                <CheckCircle2 className="text-emerald-600" /> Infrastructure Ready
              </h3>
              <p className="text-sm text-emerald-700/80 mb-5 leading-relaxed">
                Backend database generated successfully. The survey link has been automatically emailed to <strong>{adminForm.contactEmail}</strong> via your backend service.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative w-full">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LinkIcon className="h-4 w-4 text-emerald-500" />
                  </div>
                  <input 
                    type="text" 
                    readOnly 
                    value={generatedLink} 
                    className="w-full pl-10 pr-4 py-3 border border-emerald-200 rounded-xl bg-white text-slate-600 focus:outline-none shadow-inner text-sm"
                  />
                </div>
                <button 
                  onClick={() => navigator.clipboard.writeText(generatedLink)}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl whitespace-nowrap font-semibold shadow-md transition-all active:scale-95"
                >
                  Copy Link
                </button>
              </div>
              
              <div className="mt-6 flex flex-col sm:flex-row justify-between items-center border-t border-emerald-200/50 pt-4 gap-4">
                <div className="flex flex-wrap items-center gap-4">
                  <a 
                    href={getMailtoLink()}
                    className="text-indigo-600 hover:text-indigo-800 font-semibold text-sm flex items-center gap-1.5 transition-colors"
                  >
                    <Mail size={16} /> Open Email
                  </a>
                  
                  {adminForm.contactPhone && (
                    <a 
                      href={getWhatsAppLink()}
                      target="_blank" rel="noopener noreferrer"
                      className="text-emerald-600 hover:text-emerald-800 font-semibold text-sm flex items-center gap-1.5 transition-colors"
                    >
                      <MessageCircle size={16} /> Send via WhatsApp
                    </a>
                  )}
                </div>

                <button 
                  onClick={previewSurvey}
                  className="text-emerald-700 hover:text-emerald-900 font-semibold text-sm flex items-center gap-1.5 group"
                >
                  Preview Employee Experience 
                  <Send size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderSurveyView = () => (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in pb-12">
      
      {/* Only show the Back button if the admin is previewing the survey. Hide it for actual employees. */}
      {!isEmployeeLink && (
        <button 
          onClick={() => { 
            window.history.pushState({}, '', window.location.pathname); 
            setCurrentView('admin'); 
          }} 
          className="text-sm text-slate-500 hover:text-slate-900 font-medium flex items-center gap-1.5 mb-2 transition-colors px-2"
        >
          <ArrowLeft size={16} /> Return to Admin
        </button>
      )}

      <div className="bg-white rounded-[2rem] shadow-[0_20px_50px_rgb(0,0,0,0.06)] border border-slate-100 overflow-hidden relative">
        
        {/* Banner */}
        <div className="bg-slate-900 p-10 md:p-14 text-center text-white relative overflow-hidden">
          {/* Abstract background elements */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20 pointer-events-none">
            <div className="absolute -top-[50%] -left-[10%] w-[70%] h-[150%] bg-gradient-to-br from-indigo-500/40 to-transparent rotate-12 rounded-full blur-3xl"></div>
            <div className="absolute top-[20%] -right-[20%] w-[60%] h-[120%] bg-gradient-to-bl from-blue-400/30 to-transparent -rotate-12 rounded-full blur-3xl"></div>
          </div>

          <div className="relative z-10">
            <div className="w-16 h-16 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
              <Laptop className="text-indigo-300 w-8 h-8" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-3 tracking-tight">{targetCompany}</h2>
            <p className="text-indigo-200 text-lg md:text-xl font-light">Staff Device Empowerment Program</p>
          </div>
        </div>

        {surveyStatus === 'success' ? (
          <div className="p-12 text-center animate-fade-in">
            <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border border-emerald-100">
              <CheckCircle2 size={48} className="text-emerald-500" />
            </div>
            <h3 className="text-3xl font-bold text-slate-900 mb-3">Request Logged</h3>
            <p className="text-slate-500 text-lg mb-8 max-w-md mx-auto">
              Your device preference has been successfully captured and routed to HR for affordability and check-off verification.
            </p>
            <button 
              onClick={() => { setSurveyStatus('idle'); setSurveyForm({...surveyForm, selectedDeviceId: '', payrollConsent: false}); }}
              className="inline-flex items-center justify-center px-6 py-3 border-2 border-slate-200 hover:border-slate-300 text-slate-700 font-semibold rounded-xl transition-all hover:bg-slate-50"
            >
              Submit another request
            </button>
          </div>
        ) : (
          <div className="p-8 md:p-12">
            
            <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-5 mb-10 flex items-start gap-4">
              <ShieldAlert className="text-blue-500 mt-0.5 shrink-0" size={20} />
              <div className="text-sm text-blue-900/80 leading-relaxed">
                <strong className="text-blue-900 font-semibold block mb-1">Approval Process</strong>
                Completion of this form logs your interest. Final eligibility is determined by your employer's HR and Finance departments based on your salary band and consent to the check-off model.
              </div>
            </div>

            <form onSubmit={handleSubmitSurvey} className="space-y-8">
              
              {/* Step 1: Identity */}
              <div className="space-y-6">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs">1</span> 
                  Identity & Role
                </h3>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Full Legal Name</label>
                  <input 
                    required type="text" name="employeeName" value={surveyForm.employeeName} onChange={handleSurveyChange}
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    placeholder="As it appears on payroll"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Corporate Eligibility Band</label>
                  <select 
                    required name="roleTier" value={surveyForm.roleTier} onChange={handleSurveyChange}
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none"
                  >
                    <option value="" disabled>Select your official role category...</option>
                    {ROLE_BANDS.map(band => <option key={band} value={band}>{band}</option>)}
                  </select>
                </div>
              </div>

              {/* Step 2: Device Selection (Conditional) */}
              {surveyForm.roleTier && (
                <div className="space-y-6 animate-fade-in pt-4">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs">2</span> 
                    Hardware Selection
                  </h3>
                  
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Approved Devices for {surveyForm.roleTier}</label>
                    <select 
                      required name="selectedDeviceId" value={surveyForm.selectedDeviceId} onChange={handleSurveyChange}
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none"
                    >
                      <option value="" disabled>
                        {availableDevices.length > 0 ? "Select a device to view pricing..." : "No devices available for this band."}
                      </option>
                      {availableDevices.map(device => (
                        <option key={device.id} value={device.id}>
                          {device.name} - {formatPrice(device.price)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Step 3: Plan & Consent (Conditional) */}
              {surveyForm.selectedDeviceId && (
                <div className="space-y-8 animate-fade-in pt-4">
                  
                  <div className="space-y-6">
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
                      <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs">3</span> 
                      Connectivity & Consent
                    </h3>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Offer Architecture</label>
                      <select 
                        required name="category" value={surveyForm.category} onChange={handleSurveyChange}
                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none"
                      >
                        <option value="" disabled>Select how you want the device packaged...</option>
                        {CONNECTIVITY_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>

                    {surveyForm.category.includes('Category 1') && (
                      <div className="animate-fade-in">
                        <label className="block text-sm font-semibold text-slate-700 mb-3">Preferred Network Provider</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {NETWORKS.map(net => (
                            <label 
                              key={net} 
                              className={`
                                relative flex items-center justify-center p-4 cursor-pointer rounded-xl border-2 transition-all duration-200
                                ${surveyForm.network === net 
                                  ? 'border-indigo-600 bg-indigo-50 shadow-sm' 
                                  : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50'}
                              `}
                            >
                              <input 
                                type="radio" name="network" value={net} 
                                checked={surveyForm.network === net} onChange={handleSurveyChange} 
                                className="sr-only" required
                              />
                              <div className="flex flex-col items-center gap-2">
                                <Wifi className={surveyForm.network === net ? 'text-indigo-600' : 'text-slate-400'} size={20} />
                                <span className={`text-sm font-semibold ${surveyForm.network === net ? 'text-indigo-900' : 'text-slate-600'}`}>
                                  {net}
                                </span>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-6 border-t border-slate-200">
                    <label className="group relative flex items-start gap-4 cursor-pointer p-5 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-indigo-200 transition-all">
                      <div className="flex-shrink-0 mt-0.5">
                        <div className={`w-6 h-6 rounded border flex items-center justify-center transition-colors ${surveyForm.payrollConsent ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'}`}>
                          {surveyForm.payrollConsent && <CheckCircle2 size={16} className="text-white" />}
                        </div>
                        <input 
                          required type="checkbox" name="payrollConsent" 
                          checked={surveyForm.payrollConsent} onChange={handleSurveyChange}
                          className="sr-only"
                        />
                      </div>
                      <div className="flex-1">
                        <span className="text-slate-800 font-semibold block mb-1 flex items-center gap-2">
                          <CreditCard size={16} className="text-slate-500" /> Payroll Check-off Consent
                        </span>
                        <span className="text-sm text-slate-500 leading-relaxed block">
                          I hereby consent to a salary check-off deduction spanning 12-24 months for the financing of this device program. I understand this request is subject to final employer verification and budgetary approval.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              <button 
                type="submit" 
                disabled={surveyStatus === 'submitting' || !surveyForm.selectedDeviceId}
                className="w-full mt-8 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-xl flex justify-center items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl shadow-indigo-600/20 transform hover:-translate-y-0.5"
              >
                {surveyStatus === 'submitting' ? 'Processing Request...' : 'Submit Official Request'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50/40 via-slate-50 to-slate-100 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />

      {/* Premium Header */}
      <header className="max-w-6xl mx-auto pt-6 pb-8 px-4 md:px-8">
        <div className="flex items-center justify-between bg-white/60 backdrop-blur-md border border-white/40 shadow-sm rounded-2xl px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-blue-700 text-white rounded-xl flex items-center justify-center font-bold text-2xl shadow-lg shadow-indigo-500/30">
              T
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">TEP Connect</h1>
              <p className="text-xs text-indigo-600 uppercase tracking-widest font-bold">Enterprise Portal</p>
            </div>
          </div>
          
          {/* Hide the "Employee Facing View" pill on the live link as well */}
          {currentView === 'survey' && !isEmployeeLink && (
            <div className="hidden sm:flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-700 px-4 py-1.5 rounded-full text-sm font-semibold">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
              Employee Facing View
            </div>
          )}
        </div>
      </header>

      <main className="px-4 md:px-8">
        {currentView === 'admin' ? renderAdminView() : renderSurveyView()}
      </main>
      
    </div>
  );
}