"use client";

import React, { useEffect, useState } from 'react';
import { useVibe } from '../../context/VibeContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { BarChart3, ShieldAlert, Sparkles, BrainCircuit, Activity, HeartHandshake } from 'lucide-react';

export default function AnalyticsPage() {
  const { token, username } = useVibe();
  
  const [weeklyReport, setWeeklyReport] = useState<any>(null);
  const [loadingReport, setLoadingReport] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Mock charts fallback data
  const [barData, setBarData] = useState<any[]>([
    { name: 'Happy', percentage: 35, color: '#8b5cf6' },
    { name: 'Chill', percentage: 25, color: '#3b82f6' },
    { name: 'Sad', percentage: 15, color: '#6366f1' },
    { name: 'Focus', percentage: 15, color: '#10b981' },
    { name: 'Stressed', percentage: 10, color: '#06b6d4' }
  ]);

  useEffect(() => {
    if (token) {
      fetchWeeklyReport();
    }
  }, [token]);

  const fetchWeeklyReport = async () => {
    setLoadingReport(true);
    setErrorMsg(null);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

    try {
      const res = await fetch(`${apiUrl}/api/ai/weekly-report`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (data.moodBreakdown) {
        setWeeklyReport(data);
        
        // Map data breakdown into bar chart representation
        const chartData = Object.entries(data.moodBreakdown).map(([key, val]) => {
          const colors: Record<string, string> = {
            happy: '#8b5cf6',
            chill: '#3b82f6',
            sad: '#6366f1',
            focus: '#10b981',
            stressed: '#06b6d4',
            energetic: '#ec4899'
          };
          return {
            name: key.toUpperCase(),
            percentage: Number(val),
            color: colors[key.toLowerCase()] || '#8b5cf6'
          };
        });
        setBarData(chartData);
      } else {
        setErrorMsg('Failed to process wellness analytics payload.');
      }
    } catch (err) {
      setErrorMsg('Express server connection failure. Wellness core offline.');
    } finally {
      setLoadingReport(false);
    }
  };

  if (!username) return null;

  return (
    <div className="p-4 md:p-10 flex flex-col gap-8 w-full max-w-7xl mx-auto">
      {/* Title */}
      <div className="flex justify-between items-start md:items-center flex-col md:flex-row gap-4">
        <div>
          <span className="text-xs text-slate-500 uppercase font-bold tracking-widest">Cognitive Analytics</span>
          <h2 className="text-3xl font-extrabold text-white mt-1">Emotional Health Dashboard</h2>
          <p className="text-slate-400 text-sm mt-1">Analyze mood trends, burnout risk logs, and weekly psychotherapeutic sound reports.</p>
        </div>

        <button
          onClick={fetchWeeklyReport}
          disabled={loadingReport}
          className="bg-white text-slate-900 rounded-xl px-5 py-3 font-bold text-xs uppercase tracking-wide flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4 fill-current text-slate-900" />
          {loadingReport ? 'Running AI Engine...' : 'Sync AI Wellness Report'}
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2 max-w-2xl">
          <ShieldAlert className="w-4.5 h-4.5 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Charts */}
        <section className="lg:col-span-1 glass-panel border border-white/5 rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-400" /> Vibe Category Ratios
            </h3>
            <p className="text-slate-400 text-xs mb-6">Percentage breakdown of emotional nodes detected across journaling and camera scans.</p>
          </div>

          <div className="w-full h-[250px] my-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#475569" fontSize={8} />
                <YAxis stroke="#475569" fontSize={8} domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '9px' }}
                />
                <Bar dataKey="percentage" radius={[8, 8, 0, 0]}>
                  {barData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-slate-950/40 rounded-2xl p-4 border border-white/5 text-[10px] text-slate-500 leading-relaxed font-mono">
            SUMMATION: 100% COMPLETE NODE HISTORY
          </div>
        </section>

        {/* Right Side: AI Wellness Report Card */}
        <section className="lg:col-span-2 glass-panel border border-white/5 rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-white font-bold text-lg mb-2 flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-pink-400" /> Weekly AI Wellness Profile
            </h3>
            <p className="text-slate-400 text-xs mb-6">Curated analysis synthesized by Gemini based on your emotional timeline patterns.</p>
            
            {loadingReport ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <span className="w-8 h-8 rounded-full border-2 border-pink-500 border-t-transparent animate-spin"></span>
                <span className="text-slate-500 text-xs">Synthesizing listening behavior datasets...</span>
              </div>
            ) : !weeklyReport ? (
              <div className="text-center py-28 text-slate-500 text-xs leading-relaxed">
                Click 'Sync AI Wellness Report' above to query the model and load your cognitive music logs.
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {/* Summary */}
                <div className="bg-slate-950/20 border border-white/5 p-4 rounded-2xl">
                  <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest block mb-1">Therapeutic Narrative</span>
                  <p className="text-slate-300 text-xs md:text-sm leading-relaxed">{weeklyReport.wellnessSummary}</p>
                </div>

                {/* Burnout Indicator */}
                <div className="flex items-center justify-between bg-slate-950/40 border border-white/5 p-4 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-rose-400 animate-pulse" />
                    <div className="flex flex-col">
                      <span className="text-[9px] text-slate-500 uppercase font-bold">Burnout Index</span>
                      <span className="text-xs text-white font-semibold">Stress Recovery Load</span>
                    </div>
                  </div>
                  <span className="text-sm font-extrabold text-rose-400 bg-rose-500/10 px-3 py-1 rounded-xl border border-rose-500/20">{weeklyReport.burnoutRisk}</span>
                </div>

                {/* Recommendations list */}
                <div>
                  <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest block mb-3">Suggested Pacing Actions</span>
                  <div className="flex flex-col gap-2.5">
                    {weeklyReport.recommendations?.map((rec: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-3 bg-slate-950/20 border border-white/5 p-3 rounded-xl">
                        <HeartHandshake className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="text-xs text-slate-300 leading-normal">{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>

          {weeklyReport && (
            <div className="text-[9px] text-slate-500 font-mono mt-6 text-right leading-none">
              SECURE ENGINE ENCRYPTED • NEURO_V2
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
