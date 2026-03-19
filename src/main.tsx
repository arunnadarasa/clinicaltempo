import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import BattleApp from './BattleApp.tsx'
import CoachingApp from './CoachingApp.tsx'
import BeatsApp from './BeatsApp.tsx'
import CardApp from './CardApp.tsx'
import TravelApp from './TravelApp.tsx'
import EmailApp from './EmailApp.tsx'
import SocialApp from './SocialApp.tsx'
import MusicApp from './MusicApp.tsx'
import OpsApp from './OpsApp.tsx'
import KicksApp from './KicksApp.tsx'
import Tip20App from './Tip20App.tsx'

const isBattleRoute = window.location.pathname === '/battle'
const isCoachingRoute = window.location.pathname === '/coaching'
const isBeatsRoute = window.location.pathname === '/beats'
const isCardRoute = window.location.pathname === '/card'
const isTravelRoute = window.location.pathname === '/travel'
const isEmailRoute = window.location.pathname === '/email'
const isSocialRoute = window.location.pathname === '/social'
const isMusicRoute = window.location.pathname === '/music'
const isOpsRoute = window.location.pathname === '/ops'
const isKicksRoute = window.location.pathname === '/kicks'
const isTip20Route = window.location.pathname === '/tip20'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isBattleRoute ? (
      <BattleApp />
    ) : isCoachingRoute ? (
      <CoachingApp />
    ) : isBeatsRoute ? (
      <BeatsApp />
    ) : isCardRoute ? (
      <CardApp />
    ) : isTravelRoute ? (
      <TravelApp />
    ) : isEmailRoute ? (
      <EmailApp />
    ) : isSocialRoute ? (
      <SocialApp />
    ) : isMusicRoute ? (
      <MusicApp />
    ) : isOpsRoute ? (
      <OpsApp />
    ) : isKicksRoute ? (
      <KicksApp />
    ) : isTip20Route ? (
      <Tip20App />
    ) : (
      <App />
    )}
  </StrictMode>,
)
