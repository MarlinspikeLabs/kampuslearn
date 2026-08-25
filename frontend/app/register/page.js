'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GraduationCap, Loader2, ChevronRight, ChevronLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const UNI_LEVELS  = ['100','200','300','400','500','600'];
const POLY_LEVELS = ['ND1','ND2','HND1','HND2'];

// Step indicator
function StepBar({ step }) {
  const steps = ['Account', 'Institution', 'Confirm'];
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold
            transition-colors ${i < step ? 'bg-blue-600 text-white' :
              i === step ? 'bg-blue-600 text-white ring-4 ring-blue-100' :
              'bg-gray-100 text-gray-400'}`}>
            {i < step ? '✓' : i + 1}
          </div>
          <span className={`text-xs font-medium hidden sm:block
            ${i === step ? 'text-blue-600' : 'text-gray-400'}`}>{s}</span>
          {i < steps.length - 1 && (
            <div className={`w-8 h-0.5 ${i < step ? 'bg-blue-600' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Form state
  const [form, setForm] = useState({
    full_name: '', email: '', password: '', confirm_password: '',
    institution_id: '', institution_type: '',
    faculty_id: '', school_id: '',
    department_id: '', level: '', matric_number: '',
    referral_code: '',
  });

  // Pick up ?ref= from URL on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref');
      if (ref) set('referral_code', ref.toUpperCase());
    }
  }, []);

  // Dropdown data
  const [institutions, setInstitutions]   = useState([]);
  const [faculties, setFaculties]         = useState([]);
  const [schools, setSchools]             = useState([]);
  const [departments, setDepartments]     = useState([]);
  const [loadingDeps, setLoadingDeps]     = useState(false);

  // Load institutions on mount
  useEffect(() => {
    api.get('/institutions')
      .then(r => setInstitutions(r.data.data))
      .catch(() => toast.error('Failed to load institutions'));
  }, []);

  // Load faculties or schools when institution changes
  useEffect(() => {
    if (!form.institution_id || !form.institution_type) return;
    setFaculties([]); setSchools([]); setDepartments([]);
    setForm(p => ({ ...p, faculty_id: '', school_id: '', department_id: '', level: '' }));
    setLoadingDeps(true);

    const endpoint = form.institution_type === 'university'
      ? `/institutions/${form.institution_id}/faculties`
      : `/institutions/${form.institution_id}/schools`;

    api.get(endpoint)
      .then(r => {
        if (form.institution_type === 'university') setFaculties(r.data.data);
        else setSchools(r.data.data);
      })
      .catch(() => toast.error('Failed to load departments'))
      .finally(() => setLoadingDeps(false));
  }, [form.institution_id, form.institution_type]);

  // Load departments when faculty/school changes
  useEffect(() => {
    const parentId = form.faculty_id || form.school_id;
    if (!parentId) return;
    setDepartments([]);
    setForm(p => ({ ...p, department_id: '', level: '' }));
    setLoadingDeps(true);

    const endpoint = form.faculty_id
      ? `/institutions/faculties/${form.faculty_id}/departments`
      : `/institutions/schools/${form.school_id}/departments`;

    api.get(endpoint)
      .then(r => setDepartments(r.data.data))
      .catch(() => toast.error('Failed to load departments'))
      .finally(() => setLoadingDeps(false));
  }, [form.faculty_id, form.school_id]);

  const set = (field, value) =>
    setForm(p => ({ ...p, [field]: value }));

  const handleInstitutionChange = (id) => {
    const inst = institutions.find(i => i.id === id);
    if (!inst) return;
    setForm(p => ({
      ...p,
      institution_id:   id,
      institution_type: inst.type,
      faculty_id: '', school_id: '', department_id: '', level: ''
    }));
  };

  // Step validation
  const validateStep0 = () => {
    if (!form.full_name.trim())   { toast.error('Enter your full name'); return false; }
    if (!form.email.trim())       { toast.error('Enter your email'); return false; }
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return false; }
    if (form.password !== form.confirm_password) { toast.error('Passwords do not match'); return false; }
    return true;
  };

  const validateStep1 = () => {
    if (!form.institution_id) { toast.error('Select your institution'); return false; }
    if (form.institution_type === 'university' && !form.faculty_id) {
      toast.error('Select your faculty'); return false;
    }
    if (form.institution_type === 'polytechnic' && !form.school_id) {
      toast.error('Select your school'); return false;
    }
    if (!form.department_id) { toast.error('Select your department'); return false; }
    if (!form.level)         { toast.error('Select your level'); return false; }
    return true;
  };

  const nextStep = () => {
    if (step === 0 && !validateStep0()) return;
    if (step === 1 && !validateStep1()) return;
    setStep(s => s + 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload = {
        full_name:     form.full_name.trim(),
        email:         form.email.trim().toLowerCase(),
        password:      form.password,
        role:          'student',
        institution_id: form.institution_id,
        faculty_id:    form.faculty_id   || undefined,
        school_id:     form.school_id    || undefined,
        department_id: form.department_id,
        level:         form.level,
        matric_number: form.matric_number || undefined,
        referral_code: form.referral_code   || undefined,
      };
      await register(payload);
      toast.success('Account created! Welcome to KampusLearn.');
      router.push('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed';
      toast.error(msg);
      setStep(0);
    } finally {
      setLoading(false);
    }
  };

  const levels = form.institution_type === 'polytechnic' ? POLY_LEVELS : UNI_LEVELS;
  const selectedInst = institutions.find(i => i.id === form.institution_id);
  const selectedFac  = faculties.find(f => f.id === form.faculty_id);
  const selectedSch  = schools.find(s => s.id === form.school_id);
  const selectedDept = departments.find(d => d.id === form.department_id);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50
                    flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">

        {/* Logo */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2 justify-center">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-2xl text-gray-900">KampusLearn</span>
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Create your account</h1>
          <p className="mt-1 text-gray-500 text-sm">Free forever. No credit card needed.</p>
        </div>

        <StepBar step={step} />

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">

          {/* ── STEP 0: Account details ───────────────────── */}
          {step === 0 && (
            <div className="space-y-5">
              <h2 className="font-semibold text-gray-900 text-lg mb-4">Your details</h2>

              <div>
                <label className="label">Full name</label>
                <input className="input" placeholder="e.g. Amina Ibrahim"
                  value={form.full_name} onChange={e => set('full_name', e.target.value)} />
              </div>
              <div>
                <label className="label">Email address</label>
                <input className="input" type="email" placeholder="you@example.com"
                  value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
              <div>
                <label className="label">Password</label>
                <input className="input" type="password" placeholder="At least 8 characters"
                  value={form.password} onChange={e => set('password', e.target.value)} />
              </div>
              <div>
                <label className="label">Confirm password</label>
                <input className="input" type="password" placeholder="Repeat password"
                  value={form.confirm_password}
                  onChange={e => set('confirm_password', e.target.value)} />
              </div>
            </div>
          )}

          {/* ── STEP 1: Institution ───────────────────────── */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="font-semibold text-gray-900 text-lg mb-4">Your institution</h2>

              <div>
                <label className="label">Institution</label>
                <select className="input" value={form.institution_id}
                  onChange={e => handleInstitutionChange(e.target.value)}>
                  <option value="">Select institution...</option>
                  {institutions.map(i => (
                    <option key={i.id} value={i.id}>{i.name} ({i.short_name})</option>
                  ))}
                </select>
              </div>

              {/* Faculty (university) */}
              {form.institution_type === 'university' && (
                <div>
                  <label className="label">Faculty</label>
                  <select className="input" value={form.faculty_id}
                    onChange={e => set('faculty_id', e.target.value)}
                    disabled={loadingDeps || faculties.length === 0}>
                    <option value="">
                      {loadingDeps ? 'Loading...' : 'Select faculty...'}
                    </option>
                    {faculties.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* School (polytechnic) */}
              {form.institution_type === 'polytechnic' && (
                <div>
                  <label className="label">School</label>
                  <select className="input" value={form.school_id}
                    onChange={e => set('school_id', e.target.value)}
                    disabled={loadingDeps || schools.length === 0}>
                    <option value="">
                      {loadingDeps ? 'Loading...' : 'Select school...'}
                    </option>
                    {schools.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Department */}
              {(form.faculty_id || form.school_id) && (
                <div>
                  <label className="label">Department</label>
                  <select className="input" value={form.department_id}
                    onChange={e => set('department_id', e.target.value)}
                    disabled={loadingDeps || departments.length === 0}>
                    <option value="">
                      {loadingDeps ? 'Loading...' : 'Select department...'}
                    </option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Level */}
              {form.department_id && (
                <div>
                  <label className="label">Level</label>
                  <select className="input" value={form.level}
                    onChange={e => set('level', e.target.value)}>
                    <option value="">Select level...</option>
                    {levels.map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Matric (optional) */}
              <div>
                <label className="label">
                  Matric number <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input className="input" placeholder="e.g. 22/ENG/CPE/001"
                  value={form.matric_number}
                  onChange={e => set('matric_number', e.target.value)} />
              </div>
              <div>
                <label className="label">
                  Referral code <span className="text-gray-400 font-normal">(optional — earn 20 KP)</span>
                </label>
                <input className="input" placeholder="e.g. USMA1VKB"
                  value={form.referral_code}
                  onChange={e => set('referral_code', e.target.value.toUpperCase())} />
              </div>
            </div>
          )}

          {/* ── STEP 2: Confirm ───────────────────────────── */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-gray-900 text-lg mb-4">Confirm your details</h2>

              {[
                { label: 'Name',        value: form.full_name },
                { label: 'Email',       value: form.email },
                { label: 'Institution', value: selectedInst?.name },
                { label: form.institution_type === 'university' ? 'Faculty' : 'School',
                  value: selectedFac?.name || selectedSch?.name },
                { label: 'Department',  value: selectedDept?.name },
                { label: 'Level',       value: form.level ? `${form.level} Level` : '' },
                { label: 'Matric No',   value: form.matric_number || '—' },
              ].map(row => row.value && (
                <div key={row.label} className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-500">{row.label}</span>
                  <span className="text-sm font-medium text-gray-900">{row.value}</span>
                </div>
              ))}

              <p className="text-xs text-gray-400 pt-2">
                By creating an account you agree to our terms of service.
              </p>
            </div>
          )}

          {/* Navigation buttons */}
          <div className={`flex mt-8 gap-3 ${step > 0 ? 'justify-between' : 'justify-end'}`}>
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)}
                      className="btn-secondary flex items-center gap-1">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
            {step < 2 ? (
              <button onClick={nextStep}
                      className="btn-primary flex items-center gap-1 px-6">
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={loading}
                      className="btn-primary flex items-center gap-2 px-6">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Creating account...' : 'Create account'}
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-sm text-gray-600 mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 font-medium hover:underline">
            Log in
          </Link>
        </p>
        <p className="text-center text-xs text-gray-400 mt-2">
          &copy; 2026 KampusLearn. Your study mate.
        </p>
      </div>
    </div>
  );
}
