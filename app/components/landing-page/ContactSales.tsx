
import Navbar from "./Navbar";
import Footer from "./Footer";
import { useRef, useState } from 'react';
import { Mail, RefreshCcw, Users, Plus, Minus, ArrowRight } from 'lucide-react';

export default function ContactSales() {
  const [teamSize, setTeamSize] = useState(10);
  const [view, setView] = useState<'benefits' | 'alternative'>('benefits');

  const incrementTeam = () => setTeamSize(prev => prev + 1);
  const decrementTeam = () => setTeamSize(prev => Math.max(1, prev - 1));
  const [form, setForm] = useState({ name: '', email: '', note: '' });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const nameRef = useRef(null);

  const handleChange = (e: { target: { name: any; value: any; }; }) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const handleSubmit = async (e: { preventDefault: () => void; }) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSent(false);

    setTimeout(() => {
      setLoading(false);
      setSent(true);
      setForm({ name: '', email: '', note: '' });
    }, 1200);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans selection:bg-blue-100 selection:text-blue-900 overflow-hidden">
      <Navbar />
      {/* Background blobs - giữ lại nếu muốn */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden h-full w-full">
        <svg className="absolute -top-[20%] -right-[10%] w-[100%] h-[100%] opacity-[0.4]" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
          <path d="M915,595Q845,690,755,755Q665,820,535,845Q405,870,305,805Q205,740,155,625Q105,510,145,395Q185,280,290,205Q395,130,535,120Q675,110,790,200Q905,290,945,445Q985,600,915,595Z" fill="#F3F4F6"></path>
        </svg>
        <svg className="absolute top-[30%] -left-[15%] w-[90%] h-[90%] opacity-[0.3]" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
          <path d="M830,610Q770,720,660,795Q550,870,410,850Q270,830,195,720Q120,610,165,490Q210,370,310,285Q410,200,560,180Q710,160,795,280Q880,400,855,515Q830,630,830,610Z" fill="#E5E7EB"></path>
        </svg>
      </div>

      <main className="flex-grow flex items-center justify-center py-24 px-2 md:px-8 relative z-10">
        <div className="container mx-auto px-2 md:px-8 max-w-6xl w-full grid lg:grid-cols-[1.1fr_1fr] gap-24 items-start">
          
          {/* Left Column */}
          <div className="space-y-10">
              {view === 'benefits' ? (
                <div className="space-y-12">
                  <div className="space-y-4">
                    <button 
                      onClick={() => setView('alternative')}
                      className="group flex items-center gap-2 text-[38px] font-bold tracking-tight hover:text-blue-600 transition-colors leading-[1.2]"
                    >
                      Talk to a human <ArrowRight className="w-9 h-9 stroke-[1.5] group-hover:translate-x-1 transition-transform" />
                    </button>
                    <p className="text-[18px] text-gray-500 font-medium">
                      Help us help you get the most out of Flux.
                    </p>
                  </div>
                  <ul className="space-y-5">
                    {["Get custom pricing for your unique project management needs.",
                      "Learn more about our Pro, Business, and Enterprise roadmap.",
                      "Implement Flux for your hierarchies, workflows, and best practices."
                    ].map((benefit, i) => (
                      <li key={i} className="flex items-start gap-4">
                        <div className="mt-1 w-5 h-5 bg-[#2563EB] rounded-full flex items-center justify-center flex-shrink-0">
                           <svg viewBox="0 0 24 24" fill="none" className="w-3 h-3 text-white stroke-[4]" xmlns="http://www.w3.org/2000/svg"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                        <span className="text-[17px] font-medium text-gray-700 leading-snug tracking-tight">{benefit}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Testimonial */}
                  <div className="p-10 bg-white/40 border border-gray-100 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.02)] space-y-10">
                    <p className="text-[18px] leading-[1.6] text-gray-600 font-medium tracking-tight">
                      “The Flux team is creating a product that our business has been needing for years. Modern features, flexible workflows, without sacrificing reporting abilities. The full roll-out can not happen fast enough.”
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-10">
                  <div className="space-y-10">
                    {[
                      {
                        icon: <Mail className="w-5 h-5 text-gray-700" />,
                        title: "Prefer email?",
                        link: "sales@Flux.com",
                        description: "Drop us a line at "
                      },
                      {
                        icon: <RefreshCcw className="w-5 h-5 text-gray-700" />,
                        title: "Moving from another tool?",
                        description: "We will sweeten the deal for you if you are locked-in."
                      },
                      {
                        icon: <Users className="w-5 h-5 text-gray-700" />,
                        title: "More than 500 seats?",
                        description: "Get white-glove onboarding to help get started."
                      }
                    ].map((item, i) => (
                      <div 
                        key={i} 
                        className="flex items-start gap-6 group cursor-pointer"
                        onClick={() => i === 0 && setView('benefits')}
                      >
                        <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                          {item.icon}
                        </div>
                        <div className="space-y-1.5 py-1">
                          <h3 className="font-bold text-[18px] text-gray-900">{item.title}</h3>
                          <p className="text-[15px] text-gray-500 font-medium leading-relaxed">
                            {item.description}
                            {item.link && <a href={`mailto:${item.link}`} className="text-blue-600 underline underline-offset-4">{item.link}</a>}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>

          {/* Right Column - Form */}
          <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border shadow-2xl p-10 md:p-12 space-y-10 min-w-[340px] md:min-w-[540px] max-w-full min-h-[520px]">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-2.5">
                <label className="text-sm font-bold text-foreground">Your name*</label>
                <input
                  ref={nameRef}
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  required
                  className="w-full min-w-0 px-4 py-3.5 rounded-lg border border-border bg-white placeholder:text-muted-foreground text-base font-normal transition-all duration-150 focus:bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 hover:bg-muted hover:border-primary/60"
                  disabled={loading}
                  autoComplete="name"
                  maxLength={48}
                />
              </div>
              <div className="space-y-2.5">
                <label className="text-sm font-bold text-foreground">Your e-mail*</label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="sales@Flux.com"
                  required
                  className="w-full min-w-0 px-4 py-3.5 rounded-lg border border-border bg-white placeholder:text-muted-foreground text-base font-normal transition-all duration-150 focus:bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 hover:bg-muted hover:border-primary/60"
                  disabled={loading}
                  autoComplete="email"
                  maxLength={64}
                />
              </div>
            </div>

            <div className="space-y-2.5">
              <label className="text-sm font-bold text-foreground">How big is your team?*</label>
              <div className="relative flex items-center">
                <input
                  type="number"
                  value={teamSize}
                  readOnly
                  className="w-full px-4 py-3.5 rounded-lg border border-border bg-white placeholder:text-muted-foreground text-base font-normal transition-all duration-150 focus:bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 hover:bg-muted hover:border-primary/60 pr-24 font-medium"
                  tabIndex={-1}
                />
                <div className="absolute right-2 flex gap-1 bg-white rounded p-0.5 border border-border transition-all duration-150 hover:bg-muted hover:border-primary/60">
                  <button
                    type="button"
                    onClick={incrementTeam}
                    className="p-1 hover:bg-muted hover:shadow-sm rounded transition-all text-foreground disabled:opacity-60"
                    disabled={loading}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={decrementTeam}
                    className="p-1 hover:bg-muted hover:shadow-sm rounded transition-all text-foreground disabled:opacity-60"
                    disabled={loading}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <label className="text-sm font-bold text-foreground">Want to help us help you?</label>
              <textarea
                name="note"
                rows={5}
                value={form.note}
                onChange={handleChange}
                placeholder="Details about your use case, wishlist features, whether you prefer self-managed Flux—anything goes."
                className="w-full px-4 py-3 rounded-lg border border-border bg-white placeholder:text-muted-foreground text-base font-normal transition-all duration-150 focus:bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 hover:bg-muted hover:border-primary/60 resize-none min-h-[120px]"
                disabled={loading}
                style={{minHeight: 120}}
              />
            </div>

            {error && <div className="text-red-500 text-sm font-medium">{error}</div>}
            {sent && <div className="text-green-600 text-sm font-medium">Thank you! We received your message.</div>}

            <button
              type="submit"
              className="px-6 py-2.5 bg-foreground text-background rounded-md font-bold hover:bg-primary transition-all active:scale-[0.98] text-sm shadow-sm disabled:opacity-60 disabled:pointer-events-none"
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send message'}
            </button>
          </form>

        </div>
      </main>

      <Footer />
    </div>
  );
}
