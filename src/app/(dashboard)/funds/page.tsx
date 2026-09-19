import { redirect } from 'next/navigation';

export default function FundsRedirect() {
  redirect('/piyasalar?tab=funds');
}
