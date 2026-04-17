import LegalPage from './LegalPage'
import { PRIVACY_POLICY } from '../landing/legalTexts.jsx'
export default function Privacidad() {
  return <LegalPage type="privacidad" content={PRIVACY_POLICY} />
}