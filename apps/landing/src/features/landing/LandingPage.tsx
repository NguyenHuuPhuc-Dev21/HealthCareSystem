import { useEffect } from 'react';
import LandingNavbar from './components/LandingNavbar';
import Hero from './components/Hero';
import Commitments from './components/Commitments';
import Services from './components/Services';
import HowItWorks from './components/HowItWorks';
import TrustFeatures from './components/TrustFeatures';
import Pricing from './components/Pricing';
import ForNurses from './components/ForNurses';
import CaseStory from './components/CaseStory';
import Faq from './components/Faq';
import FinalCta from './components/FinalCta';
import LandingFooter from './components/LandingFooter';

export default function LandingPage() {
    // Hiệu ứng hiện dần khi cuộn tới (class .reveal trong landing.css)
    useEffect(() => {
        const io = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('in');
                        io.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.12 }
        );
        document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
        return () => io.disconnect();
    }, []);

    return (
        <div id="top">
            <LandingNavbar />
            <main>
                <Hero />
                <Commitments />
                <Services />
                <HowItWorks />
                <TrustFeatures />
                <Pricing />
                <ForNurses />
                <CaseStory />
                <Faq />
                <FinalCta />
            </main>
            <LandingFooter />
        </div>
    );
}