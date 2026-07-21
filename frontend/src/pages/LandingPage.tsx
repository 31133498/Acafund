import Navbar from '../components/Navbar'
import Hero from '../components/Hero'
import Features from '../components/Features'
import HowItWorks from '../components/HowItWorks'
import Stats from '../components/Stats'
import CTA from '../components/CTA'
import Footer from '../components/Footer'
import FAB from '../components/FAB'

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Features />
        <HowItWorks />
        <Stats />
        <CTA />
      </main>
      <Footer />
      <FAB />
    </div>
  )
}
