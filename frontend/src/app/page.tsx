'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function Home() {
  const heroRef = useRef(null);
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/portfolio')
      .then(res => res.json())
      .then(data => {
        setPortfolio(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching portfolio:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!portfolio) return;

    const ctx = gsap.context(() => {
      gsap.from('.hero-title', { y: 100, opacity: 0, duration: 1, ease: 'power3.out' });
      gsap.from('.hero-subtitle', { y: 50, opacity: 0, duration: 1, delay: 0.3, ease: 'power3.out' });
      gsap.from('.hero-cta', { y: 30, opacity: 0, duration: 0.8, delay: 0.6, ease: 'power3.out' });

      if (portfolio.settings?.animations !== false) {
        gsap.utils.toArray('.project-card').forEach((card, i) => {
          gsap.from(card, {
            scrollTrigger: { trigger: card, start: 'top 85%', toggleActions: 'play none none reverse' },
            y: 60, opacity: 0, duration: 0.8, delay: i * 0.1, ease: 'power3.out'
          });
        });

        gsap.from('.contact-item', {
          scrollTrigger: { trigger: '.contact-section', start: 'top 80%' },
          y: 30, opacity: 0, duration: 0.6, stagger: 0.1, ease: 'power3.out'
        });
      }
    }, heroRef);

    return () => ctx.revert();
  }, [portfolio]);

  const theme = portfolio?.theme || {};
  const settings = portfolio?.settings || {};
  const colors = theme?.colors || { primary: '#0a0a0a', accent: '#6366f1', surface: '#1a1a1a' };
  const isDark = settings?.darkMode !== false;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.primary, color: '#fff' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: colors.accent }}></div>
      </div>
    );
  }

  return (
    <main ref={heroRef} className="min-h-screen" style={{ backgroundColor: colors.primary, color: '#fff' }}>
      <section className="min-h-screen flex flex-col items-center justify-center px-6 py-20 relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, ${colors.accent}10, transparent)` }}></div>
        
        <div className="max-w-4xl mx-auto text-center z-10">
          {portfolio?.profile?.avatar && (
            <img src={portfolio.profile.avatar} alt="Avatar" className="w-24 h-24 rounded-full mx-auto mb-6 object-cover border-4" style={{ borderColor: colors.accent }} />
          )}
          
          <h1 className="hero-title text-5xl md:text-7xl font-bold mb-6" style={{ fontFamily: theme?.fonts?.heading }}>
            <span style={{ color: colors.accent }}>{portfolio?.profile?.name || 'Mi Portfolio'}</span>
          </h1>
          
          <p className="hero-subtitle text-xl md:text-2xl text-gray-400 mb-8 max-w-2xl mx-auto" style={{ fontFamily: theme?.fonts?.body }}>
            {portfolio?.profile?.bio || 'Desarrollador Full Stack'}
          </p>
          
          <div className="hero-cta flex gap-4 justify-center flex-wrap">
            <a href="#projects" className="px-8 py-3 rounded-full font-medium transition-all" style={{ backgroundColor: colors.accent, color: '#fff' }}>
              Ver Proyectos
            </a>
            <a href="#contact" className="px-8 py-3 border border-gray-700 rounded-full font-medium transition-all hover:border-opacity-50">
              Contacto
            </a>
          </div>
        </div>

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce">
          <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </section>

      {portfolio?.customSections?.map((section, idx) => (
        <section key={section.id || idx} className="py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl font-bold mb-8">{section.title}</h2>
            <div dangerouslySetInnerHTML={{ __html: section.content }} />
          </div>
        </section>
      ))}

      <section id="projects" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12">
            <span style={{ color: colors.accent }}>Proyectos</span>
          </h2>

          {portfolio?.projects?.length === 0 ? (
            <div className="text-center text-gray-500 py-20">
              <p>No hay proyectos todavía.</p>
              <p className="text-sm mt-2">Gestiona tu portfolio desde Telegram</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {portfolio?.projects?.map((project) => (
                <a
                  key={project.id}
                  href={project.githubUrl || project.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="project-card block p-6 rounded-2xl border border-gray-800 hover:border-opacity-50 transition-all group"
                  style={{ backgroundColor: colors.surface }}
                >
                  {project.imageUrl && (
                    <img src={project.imageUrl} alt={project.name} className="w-full h-40 object-cover rounded-lg mb-4" />
                  )}
                  <h3 className="text-xl font-semibold mb-2 group-hover:opacity-80 transition-colors" style={{ color: colors.accent }}>
                    {project.name}
                  </h3>
                  <p className="text-gray-400 text-sm mb-4">{project.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {project.tags?.map((tag) => (
                      <span key={tag} className="text-xs px-2 py-1 bg-gray-800 rounded-full text-gray-400">{tag}</span>
                    ))}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="contact" className="contact-section py-20 px-6" style={{ backgroundColor: `${colors.surface}50` }}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-8">
            <span style={{ color: colors.accent }}>Contacto</span>
          </h2>
          
          <div className="flex justify-center gap-8 flex-wrap">
            {portfolio?.profile?.contact?.email && (
              <a href={`mailto:${portfolio.profile.contact.email}`} className="contact-item flex items-center gap-2 text-gray-400 hover:opacity-80 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {portfolio.profile.contact.email}
              </a>
            )}
            
            {portfolio?.profile?.contact?.github && (
              <a href={`https://github.com/${portfolio.profile.contact.github}`} target="_blank" rel="noopener noreferrer" className="contact-item flex items-center gap-2 text-gray-400 hover:opacity-80 transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                {portfolio.profile.contact.github}
              </a>
            )}
            
            {portfolio?.profile?.contact?.twitter && (
              <a href={`https://twitter.com/${portfolio.profile.contact.twitter}`} target="_blank" rel="noopener noreferrer" className="contact-item flex items-center gap-2 text-gray-400 hover:opacity-80 transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                {portfolio.profile.contact.twitter}
              </a>
            )}
          </div>
        </div>
      </section>

      <footer className="py-8 px-6 text-center text-gray-500 text-sm">
        <p>✨ Powered by Kwitt - AI Portfolio OS</p>
      </footer>
    </main>
  );
}