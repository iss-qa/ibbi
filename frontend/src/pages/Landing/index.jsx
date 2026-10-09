import { useEffect } from 'react';
import useAuth from '../../hooks/useAuth';
import { capturarRef } from '../../utils/indicacao';
import Nav from './Nav';
import Hero from './Hero';
import Plans from './Plans';
import { Problem, Verse, HowItWorks, Features, AttendanceShowcase, Origin, Faq, FinalCta, Footer } from './Sections';

// Landing page pública do PastorIA (rota "/").
export default function Landing() {
  const { user } = useAuth();
  useEffect(() => { capturarRef(window.location.search); }, []);

  useEffect(() => {
    const prev = document.title;
    document.title = 'PastorIA | Quem falta, faz falta.';
    return () => { document.title = prev; };
  }, []);

  return (
    <div className="bg-brandCream text-slate-800 font-body">
      <Nav user={user} />
      <main>
        <Hero />
        <Problem />
        <Verse />
        <HowItWorks />
        <Features />
        <AttendanceShowcase />
        <Plans />
        <Origin />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
