export default function Footer() {
    const technologies = ["ORCID OAuth 2.0", "SWORD v2", "DSpace", "EPrints", "Dublin Core"];
  
    return (
      <footer className="mt-auto w-full shrink-0 border-t border-surface-border bg-surface-primary py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
  
          {/* Main row */}
          <div className="flex flex-col gap-7 lg:flex-row lg:items-start lg:justify-between">
  
            {/* Brand */}
            <div className="flex flex-col gap-2 text-center lg:max-w-xs lg:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                <span className="text-base font-extrabold tracking-tight text-ink-primary">
                  ORCID<span className="text-orcid-green">2</span>SWORD
                </span>
                <span className="rounded border border-orcid-green-border bg-orcid-green-soft px-1.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-orcid-green-text">
                    Software Universitario
                </span>
              </div>
              <p className="text-sm leading-relaxed text-ink-secondary">
              Extracción y preparación de publicaciones ORCID para repositorios académicos.
              </p>
            </div>
  
            {/* Compatible con */}
            <div className="flex flex-col gap-2">
              <span className="text-center text-[10px] font-black uppercase tracking-[0.2em] text-ink-tertiary lg:text-left">
                Compatible con
              </span>
              <div className="flex flex-wrap justify-center gap-1.5 lg:justify-start">
                {technologies.map((tech) => (
                  <span
                    key={tech}
                    className="rounded border border-surface-border bg-surface-secondary px-2 py-0.5 text-[11px] font-medium text-ink-tertiary"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
  
            {/* Institutional links */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
  
              {/* Universidad de Jaén */}
              <a
                href="https://www.ujaen.es/"
                target="_blank" rel="noopener noreferrer"
                className="group flex items-center justify-center gap-2.5 rounded-lg border border-surface-border bg-surface-secondary/30 px-3 py-2 transition-colors hover:bg-surface-secondary/60"
                title="Ir a la web oficial de la Universidad de Jaén"
              >
                <div className="flex h-8 flex-col justify-center border-r-2 border-surface-border-strong pr-2.5 text-right transition-colors group-hover:border-brand-accent">
                  <span className="mb-0.5 text-[11px] font-bold uppercase leading-none tracking-wide text-ink-primary">Universidad</span>
                  <span className="text-[10px] font-medium uppercase leading-none tracking-[0.22em] text-ink-tertiary">de Jaén</span>
                </div>
                <img
                  src={`${import.meta.env.BASE_URL}uja-logo.png`}
                  alt="Logo UJA"
                  className="h-7 w-7 object-contain grayscale opacity-80 transition-all group-hover:grayscale-0 group-hover:opacity-100"
                />
              </a>
  
              {/* Repositorio Oficial */}
              <a
                href="https://github.com/uja-dev-practices/orcid_system"
                target="_blank" rel="noopener noreferrer"
                className="group flex items-center justify-center gap-2.5 rounded-lg border border-surface-border bg-surface-secondary/30 px-3 py-2 transition-colors hover:bg-surface-secondary/60"
                title="Ver repositorio oficial"
              >
                <div className="flex h-8 flex-col justify-center border-r-2 border-surface-border-strong pr-2.5 text-right transition-colors group-hover:border-brand-primary">
                  <span className="mb-0.5 text-[11px] font-bold uppercase leading-none tracking-wide text-ink-primary">Repositorio</span>
                  <span className="text-[10px] font-medium uppercase leading-none tracking-[0.22em] text-ink-tertiary">Oficial</span>
                </div>
                <svg className="h-7 w-7 text-ink-tertiary transition-colors group-hover:text-brand-primary" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
              </a>
  
            </div>
          </div>
  
        </div>
      </footer>
    );
  }