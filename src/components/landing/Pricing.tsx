const plans = [
  {
    id: "starter",
    name: "Starter",
    price: "Gratis",
    period: "",
    description: "Para un solo usuario que quiere empezar a organizar su conocimiento.",
    features: [
      "1 usuario",
      "Hasta 10 documentos",
      "Límite de uso de IA diario",
      "Búsqueda semántica",
    ],
    cta: "Empieza gratis",
    featured: false,
    badge: null,
    ctaHref: "/signup",
  },
  {
    id: "plus",
    name: "Plus",
    price: "$29.99",
    period: "/mes",
    description: "Para equipos pequeños que necesitan colaborar y escalar su base de conocimiento.",
    features: [
      "Hasta 5 usuarios",
      "Hasta 25 documentos",
      "IA sin límite diario",
      "Hasta 2 integraciones",
      "Fuentes citadas en el chat",
    ],
    cta: "Empezar prueba gratis",
    featured: false,
    badge: null,
    ctaHref: "/signup?plan=plus",
  },
  {
    id: "pro",
    name: "Pro",
    price: "$49.990",
    period: "/mes",
    description: "Para equipos que quieren llevar el asistente a donde ya trabajan — WhatsApp incluido.",
    features: [
      "Hasta 15 usuarios",
      "Hasta 100 documentos",
      "IA sin límite diario",
      "Hasta 5 integraciones",
      "Nukor for WhatsApp",
      "Soporte prioritario",
    ],
    cta: "Empezar prueba gratis",
    featured: true,
    badge: "Más popular",
    ctaHref: "/signup?plan=pro",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "Para organizaciones que requieren control total, soporte dedicado y acceso a la API.",
    features: [
      "Usuarios ilimitados",
      "Documentos ilimitados",
      "Acceso a la API",
      "Integraciones ilimitadas",
      "Nukor for WhatsApp",
      "Soporte prioritario",
      "Onboarding personalizado",
    ],
    cta: "Contactar ventas",
    featured: false,
    badge: null,
    ctaHref: "mailto:sales@nukor.app",
  },
];

const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 mt-0.5">
    <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const Pricing = () => (
  <section id="precios" className="py-24 md:py-32 bg-white border-b border-gray-200">
    <div className="container mx-auto px-6">
      <div className="text-center max-w-2xl mx-auto mb-20">
        <span className="inline-flex items-center px-4 py-1.5 text-[13px] font-bold tracking-widest uppercase bg-slate-50 text-gray-600 rounded-full border border-gray-200 mb-6 shadow-sm">
          Precios
        </span>
        <h2 className="font-heading text-4xl md:text-5xl font-bold tracking-tight text-gray-950 leading-tight">
          Simple, transparente, sin sorpresas
        </h2>
        <p className="mt-6 text-gray-500 text-xl font-medium leading-relaxed">
          Empieza ahora. Escala cuando estés listo.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 max-w-6xl mx-auto items-start">
        {plans.map((plan) => (
          <div key={plan.name} className={`relative flex flex-col p-8 rounded-2xl bg-white ${
            plan.featured
              ? "border-2 border-indigo-600 shadow-xl xl:-translate-y-4"
              : "border border-gray-200 shadow-sm"
          }`}>
            {plan.badge && (
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[13px] font-bold bg-indigo-600 text-white shadow-md tracking-wide uppercase whitespace-nowrap">
                {plan.badge}
              </span>
            )}
            <div className="mb-8">
              <h3 className="font-heading font-bold text-2xl mb-2 text-gray-950 tracking-tight">{plan.name}</h3>
              <div className="mt-4 flex items-baseline gap-1.5">
                <span className="font-heading text-4xl font-black text-gray-950 tracking-tight">{plan.price}</span>
                {plan.period && (
                  <span className="text-base font-semibold text-gray-500">
                    {plan.period}
                  </span>
                )}
              </div>
              <p className="mt-4 text-[15px] font-medium leading-relaxed text-gray-600">
                {plan.description}
              </p>
            </div>
            <ul className="space-y-4 mb-10 flex-1">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <span className={plan.featured ? "text-indigo-600" : "text-indigo-500"}><CheckIcon /></span>
                  <span className={`text-[15px] font-medium ${f === "Nukor for WhatsApp" ? "text-indigo-700 font-semibold" : "text-gray-600"}`}>{f}</span>
                </li>
              ))}
            </ul>
            <a href={plan.ctaHref}
               className={`w-full py-3.5 rounded-full font-semibold text-center transition-all shadow-sm ${
                 plan.featured
                    ? "bg-indigo-600 text-white hover:bg-indigo-700 hover:-translate-y-[1px]"
                    : "bg-white border border-gray-200 text-gray-950 hover:bg-slate-50 hover:border-gray-300 hover:-translate-y-[1px]"
               }`}>
              {plan.cta}
            </a>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default Pricing;
