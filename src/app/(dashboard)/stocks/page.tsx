import { redirect } from 'next/navigation';

export default function StocksRedirect() {
  redirect('/piyasalar?market=bist');
}
