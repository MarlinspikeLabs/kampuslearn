'use client';
import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Coins, TrendingUp, TrendingDown, Gift,
  Users, Copy, CheckCircle, Zap,
  ArrowRight, Loader2, Star, Share2,
  Brain, BarChart3, ShoppingCart
} from 'lucide-react';

const TX_CONFIG = {
  welcome_bonus:       { label: 'Welcome Bonus',        color: 'text-green-600',  bg: 'bg-green-50',  sign: '+' },
  referral_bonus:      { label: 'Referral Bonus',        color: 'text-blue-600',   bg: 'bg-blue-50',   sign: '+' },
  referral_join_bonus: { label: 'Joined via Referral',   color: 'text-purple-600', bg: 'bg-purple-50', sign: '+' },
  daily_login:         { label: 'Daily Login',           color: 'text-cyan-600',   bg: 'bg-cyan-50',   sign: '+' },
  cbt_completion:      { label: 'CBT Completed',         color: 'text-indigo-600', bg: 'bg-indigo-50', sign: '+' },
  content_upload:      { label: 'Content Upload',        color: 'text-teal-600',   bg: 'bg-teal-50',   sign: '+' },
  purchase:            { label: 'Token Purchase',        color: 'text-green-600',  bg: 'bg-green-50',  sign: '+' },
  ai_spend:            { label: 'AI Message',            color: 'text-red-500',    bg: 'bg-red-50',    sign: '-' },
  download_spend:      { label: 'Download',              color: 'text-red-500',    bg: 'bg-red-50',    sign: '-' },
  manual_grant:        { label: 'Bonus Grant',           color: 'text-yellow-600', bg: 'bg-yellow-50', sign: '+' },
};

function timeAgo(dateStr) {
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'Just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ── Tab: Wallet overview ──────────────────────────────────────
function WalletTab({ wallet, history, onDailyLogin, claiming }) {
  const EARN_WAYS = [
    { icon: Gift,      label: 'Welcome bonus',    amount: 50,  desc: 'One time on registration'     },
    { icon: Users,     label: 'Refer a friend',   amount: 100, desc: 'Per successful referral'      },
    { icon: Star,      label: 'Daily login',       amount: 5,   desc: 'Log in every day'            },
    { icon: BarChart3, label: 'Complete CBT test', amount: 2,   desc: 'Per submitted practice test' },
  ];

  return (
    <div className="space-y-6">
      {/* Balance card */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600
                      via-blue-700 to-indigo-800 rounded-3xl p-7 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full
                        -translate-y-12 translate-x-12" />
        <div className="relative">
          <p className="text-blue-200 text-sm font-medium mb-1">Your Token Balance</p>
          <div className="flex items-end gap-3 mb-4">
            <p className="text-6xl font-black">{wallet?.balance ?? 0}</p>
            <div className="mb-2">
              <span className="text-blue-200 text-lg font-semibold">KP</span>
              <p className="text-blue-300 text-xs">KampusCoin</p>
            </div>
          </div>
          <div className="flex gap-6">
            <div>
              <p className="text-blue-200 text-xs">Total Earned</p>
              <p className="text-white font-bold">+{wallet?.total_earned ?? 0} KP</p>
            </div>
            <div>
              <p className="text-blue-200 text-xs">Total Spent</p>
              <p className="text-white font-bold">{wallet?.total_spent ?? 0} KP</p>
            </div>
            <div>
              <p className="text-blue-200 text-xs">Referral Code</p>
              <p className="text-white font-bold font-mono">{wallet?.referral_code}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Daily login claim */}
      <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-2xl p-5
                      border border-cyan-100 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-cyan-100 rounded-xl flex items-center justify-center">
            <Star className="w-6 h-6 text-cyan-600" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">Daily Login Bonus</p>
            <p className="text-gray-500 text-xs">Earn 5 KP every day you log in</p>
          </div>
        </div>
        <button onClick={onDailyLogin} disabled={claiming}
                className="flex items-center gap-2 bg-cyan-600 text-white text-sm font-bold
                           px-5 py-2.5 rounded-xl hover:bg-cyan-700 transition-colors
                           disabled:opacity-50 flex-shrink-0">
          {claiming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
          {claiming ? 'Claiming...' : 'Claim +5 KP'}
        </button>
      </div>

      {/* How to earn */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Ways to Earn KampusCoin</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {EARN_WAYS.map(way => (
            <div key={way.label} className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                  <way.icon className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{way.label}</p>
                  <p className="text-xs text-gray-400">{way.desc}</p>
                </div>
              </div>
              <span className="text-green-600 font-black text-sm bg-green-50
                               px-3 py-1 rounded-full">
                +{way.amount} KP
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent transactions */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Transaction History</h3>
        </div>
        {history.length === 0 ? (
          <div className="text-center py-10">
            <Coins className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">No transactions yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {history.map((tx, i) => {
              const cfg = TX_CONFIG[tx.type] || { label: tx.type, color: 'text-gray-600', bg: 'bg-gray-50', sign: '' };
              return (
                <div key={i} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 ${cfg.bg} rounded-xl flex items-center justify-center`}>
                      {tx.amount > 0
                        ? <TrendingUp className={`w-4 h-4 ${cfg.color}`} />
                        : <TrendingDown className="w-4 h-4 text-red-500" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{cfg.label}</p>
                      <p className="text-xs text-gray-400">{timeAgo(tx.created_at)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-black text-sm ${tx.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount} KP
                    </p>
                    <p className="text-xs text-gray-400">{tx.balance_after} KP bal.</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab: Buy tokens ───────────────────────────────────────────
function BuyTab({ packages, balance }) {
  const [selected, setSelected]   = useState(null);
  const [loading, setLoading]     = useState(false);

  const initiatePurchase = async () => {
    if (!selected) { toast.error('Select a package first'); return; }
    setLoading(true);
    try {
      const res = await api.post('/tokens/purchase/initiate', { package_id: selected.id });
      const data = res.data.data;
      toast.success('Redirecting to payment...');
      // In production: initialize Paystack inline or redirect
      // For now show the details
      toast(`Purchase ID: ${data.purchase_id}\nAmount: ₦${data.amount_ngn}\nTokens: ${data.tokens} KP`, { duration: 5000 });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to initiate purchase');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 flex items-center gap-3">
        <Coins className="w-5 h-5 text-blue-600 flex-shrink-0" />
        <p className="text-blue-800 text-sm">
          <span className="font-bold">Current balance: {balance} KP.</span>{' '}
          1 AI message costs 1 KP. Tokens never expire.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {packages.map(pkg => (
          <button key={pkg.id} onClick={() => setSelected(pkg)}
                  className={`relative text-left p-5 rounded-2xl border-2 transition-all duration-200
                    ${selected?.id === pkg.id
                      ? 'border-blue-600 bg-blue-50 shadow-lg shadow-blue-100'
                      : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md'}`}>
            {pkg.bonus_pct > 0 && (
              <div className="absolute -top-2.5 right-4 bg-green-500 text-white text-xs
                              font-bold px-3 py-1 rounded-full">
                +{pkg.bonus_pct}% BONUS
              </div>
            )}
            {pkg.id === 'popular' && (
              <div className="absolute -top-2.5 left-4 bg-blue-600 text-white text-xs
                              font-bold px-3 py-1 rounded-full">
                MOST POPULAR
              </div>
            )}
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-black text-2xl text-gray-900">{pkg.tokens}</p>
                <p className="text-gray-500 text-xs">KampusCoin</p>
              </div>
              <Coins className={`w-6 h-6 ${selected?.id === pkg.id ? 'text-blue-600' : 'text-gray-300'}`} />
            </div>
            <p className="text-2xl font-black text-blue-600">₦{pkg.amount_ngn.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-1">
              ₦{(pkg.amount_ngn / pkg.tokens).toFixed(1)} per token ·{' '}
              ~{pkg.tokens} AI messages
            </p>
            {selected?.id === pkg.id && (
              <div className="mt-3 flex items-center gap-1.5 text-blue-600 text-xs font-semibold">
                <CheckCircle className="w-3.5 h-3.5" /> Selected
              </div>
            )}
          </button>
        ))}
      </div>

      {selected && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-3">Order Summary</h3>
          <div className="space-y-2 text-sm mb-4">
            <div className="flex justify-between">
              <span className="text-gray-500">Package</span>
              <span className="font-semibold capitalize">{selected.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Tokens</span>
              <span className="font-semibold text-blue-600">+{selected.tokens} KP</span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-2 mt-2">
              <span className="font-bold text-gray-900">Total</span>
              <span className="font-black text-gray-900">₦{selected.amount_ngn.toLocaleString()}</span>
            </div>
          </div>
          <button onClick={initiatePurchase} disabled={loading}
                  className="w-full btn-primary flex items-center justify-center gap-2 py-3">
            {loading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <ShoppingCart className="w-4 h-4" />}
            {loading ? 'Processing...' : `Pay ₦${selected.amount_ngn.toLocaleString()} via Paystack`}
          </button>
          <p className="text-xs text-gray-400 text-center mt-2">
            Secured by Paystack · Tokens credited instantly after payment
          </p>
        </div>
      )}
    </div>
  );
}

// ── Tab: Referrals ────────────────────────────────────────────
function ReferralTab() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get('/tokens/referrals')
      .then(r => setData(r.data.data))
      .catch(() => toast.error('Failed to load referrals'))
      .finally(() => setLoading(false));
  }, []);

  const copyCode = () => {
    const text = data.referral_code;
    const doCopy = () => {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text);
      } else {
        const el = document.createElement('textarea');
        el.value = text;
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
    };
    doCopy();
    setCopied(true);
    toast.success('Referral code copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const copyUrl = () => {
    const text = data.referral_url;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => toast.success('Referral link copied!'));
    } else {
      // Fallback for http
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      toast.success('Referral link copied!');
    }
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* How it works */}
      <div className="bg-gradient-to-br from-purple-600 to-blue-700 rounded-3xl p-6 text-white">
        <h3 className="font-black text-xl mb-4">Refer Friends, Earn Tokens</h3>
        <div className="grid grid-cols-3 gap-4 text-center mb-4">
          {[
            { step: '1', label: 'Share your code',    desc: 'Send your unique referral link'    },
            { step: '2', label: 'Friend registers',   desc: 'They sign up using your code'      },
            { step: '3', label: 'Both get tokens',    desc: 'You get 100 KP, they get 20 KP'   },
          ].map(s => (
            <div key={s.step} className="bg-white/10 rounded-xl p-3 border border-white/20">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center
                              font-black text-sm mx-auto mb-2">{s.step}</div>
              <p className="text-xs font-bold mb-1">{s.label}</p>
              <p className="text-xs text-purple-200">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between bg-white/10 rounded-xl px-4 py-3
                        border border-white/20">
          <div>
            <p className="text-purple-200 text-xs">Total earned from referrals</p>
            <p className="text-2xl font-black">{data.tokens_earned} KP</p>
          </div>
          <div className="text-right">
            <p className="text-purple-200 text-xs">Total referrals</p>
            <p className="text-2xl font-black">{data.total_referrals}</p>
          </div>
        </div>
      </div>

      {/* Referral code */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h3 className="font-bold text-gray-900">Your Referral Code</h3>

        <div className="flex items-center gap-3">
          <div className="flex-1 bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
            <p className="text-2xl font-black text-gray-900 tracking-widest font-mono">
              {data.referral_code}
            </p>
          </div>
          <button onClick={copyCode}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl font-semibold
                              text-sm transition-all ${copied
                                ? 'bg-green-100 text-green-700'
                                : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
            {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-200 min-w-0">
            <p className="text-xs text-gray-500 truncate">{data.referral_url}</p>
          </div>
          <button onClick={copyUrl}
                  className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2.5
                             rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors flex-shrink-0">
            <Share2 className="w-4 h-4" />
            Share Link
          </button>
        </div>
      </div>

      {/* Referral list */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">People You Referred</h3>
        </div>
        {data.referrals.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <p className="text-gray-400 text-sm font-medium">No referrals yet</p>
            <p className="text-gray-400 text-xs mt-1">
              Share your code and earn 100 KP per friend who joins
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {data.referrals.map((r, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center
                                  justify-center text-blue-600 font-bold text-sm">
                    {r.full_name?.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{r.full_name}</p>
                    <p className="text-xs text-gray-400">{timeAgo(r.joined_at)}</p>
                  </div>
                </div>
                <span className="text-green-600 font-bold text-sm bg-green-50
                                 px-3 py-1 rounded-full">
                  +100 KP
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function TokensPage() {
  const [tab, setTab]         = useState('wallet');
  const [wallet, setWallet]   = useState(null);
  const [history, setHistory] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/tokens/balance'),
      api.get('/tokens/history'),
      api.get('/tokens/packages'),
    ]).then(([b, h, p]) => {
      setWallet(b.data.data);
      setHistory(h.data.data);
      setPackages(p.data.data);
    }).catch(() => {})
    .finally(() => setLoading(false));
  }, []);

  const claimDailyLogin = async () => {
    setClaiming(true);
    try {
      const res = await api.post('/tokens/earn/daily-login');
      toast.success(res.data.message);
      setWallet(prev => ({
        ...prev,
        balance:      prev.balance + res.data.data.earned,
        total_earned: prev.total_earned + res.data.data.earned,
      }));
      setHistory(prev => [{
        type:          'daily_login',
        amount:        res.data.data.earned,
        balance_after: res.data.data.new_balance,
        description:   'Daily login bonus',
        created_at:    new Date().toISOString(),
      }, ...prev]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to claim');
    } finally {
      setClaiming(false);
    }
  };

  if (loading) return (
    <AppLayout title="Token Wallet">
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    </AppLayout>
  );

  const TABS = [
    { id: 'wallet',   label: 'Wallet',   icon: Coins   },
    { id: 'buy',      label: 'Buy KP',   icon: ShoppingCart },
    { id: 'referral', label: 'Referrals', icon: Users  },
  ];

  return (
    <AppLayout title="Token Wallet">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-gray-900">KampusCoin Wallet</h2>
          <p className="text-gray-500 text-sm mt-1">
            Earn and spend KampusCoin (KP) for AI messages and platform features
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg
                                text-sm font-semibold transition-all
                      ${tab === t.id
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'}`}>
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === 'wallet'   && <WalletTab wallet={wallet} history={history} onDailyLogin={claimDailyLogin} claiming={claiming} />}
        {tab === 'buy'      && <BuyTab packages={packages} balance={wallet?.balance ?? 0} />}
        {tab === 'referral' && <ReferralTab />}
      </div>
    </AppLayout>
  );
}
