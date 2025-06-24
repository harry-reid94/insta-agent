'use client';

import { useState, useEffect } from 'react';
import { supabaseService, LeadData } from '../app/lib/integrations/supabase';

interface DashboardStats {
  totalLeads: number;
  qualifiedLeads: number;
  qualificationRate: number;
  humanOverrides: number;
}

interface ConversationPreview {
  id: string;
  instagram_username: string;
  stage: string;
  last_message: string;
  updated_at: string;
  is_qualified?: boolean;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalLeads: 0,
    qualifiedLeads: 0,
    qualificationRate: 0,
    humanOverrides: 0
  });
  
  const [qualifiedLeads, setQualifiedLeads] = useState<LeadData[]>([]);
  const [humanOverrideLeads, setHumanOverrideLeads] = useState<LeadData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'qualified' | 'overrides'>('overview');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Get date range (last 30 days)
      const endDate = new Date().toISOString();
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      
      // Load analytics, qualified leads, and human overrides in parallel
      const [analytics, qualified, overrides] = await Promise.all([
        supabaseService.getAnalytics(startDate, endDate),
        supabaseService.getQualifiedLeads(20),
        supabaseService.getHumanOverrideLeads(20)
      ]);
      
      setStats(analytics);
      setQualifiedLeads(qualified);
      setHumanOverrideLeads(overrides);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleManualTrigger = async (conversationId: string) => {
    try {
      // This would trigger the AI workflow manually
      const response = await fetch('/api/manual-trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId })
      });
      
      if (response.ok) {
        alert('AI workflow triggered successfully');
        loadDashboardData(); // Refresh data
      } else {
        alert('Failed to trigger AI workflow');
      }
    } catch (error) {
      console.error('Error triggering AI:', error);
      alert('Error triggering AI workflow');
    }
  };

  const handleTakeOver = async (conversationId: string) => {
    try {
      // Mark conversation for human takeover
      const response = await fetch('/api/human-takeover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId })
      });
      
      if (response.ok) {
        alert('Conversation marked for human takeover');
        loadDashboardData(); // Refresh data
      } else {
        alert('Failed to mark for takeover');
      }
    } catch (error) {
      console.error('Error marking for takeover:', error);
      alert('Error marking conversation for takeover');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Instagram DM Agent Dashboard</h1>
          <p className="text-gray-600">BullMarketBlueprint Lead Qualification System</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Total Leads (30d)</h3>
            <p className="text-3xl font-bold text-gray-900">{stats.totalLeads}</p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Qualified Leads</h3>
            <p className="text-3xl font-bold text-green-600">{stats.qualifiedLeads}</p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Qualification Rate</h3>
            <p className="text-3xl font-bold text-blue-600">
              {(stats.qualificationRate * 100).toFixed(1)}%
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Human Overrides</h3>
            <p className="text-3xl font-bold text-orange-600">{stats.humanOverrides}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {['overview', 'qualified', 'overrides'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSelectedTab(tab as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm capitalize ${
                    selectedTab === tab
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'overrides' ? 'Human Overrides' : tab}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {selectedTab === 'overview' && (
              <div>
                <h3 className="text-lg font-medium mb-4">Recent Activity</h3>
                <div className="text-gray-600">
                  <p>• AI is actively monitoring Instagram DMs</p>
                  <p>• Qualification flow: Portfolio Size → Pain Points → BMB Understanding</p>
                  <p>• Minimum portfolio size for qualification: $50,000</p>
                  <p>• Qualified leads are automatically pushed to GoHighLevel</p>
                </div>
              </div>
            )}

            {selectedTab === 'qualified' && (
              <div>
                <h3 className="text-lg font-medium mb-4">Qualified Leads</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Instagram User
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Portfolio Size
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Pain Points
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {qualifiedLeads.map((lead) => (
                        <tr key={lead.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="font-medium text-gray-900">
                                @{lead.instagram_username}
                              </div>
                              <div className="text-sm text-gray-500">
                                {lead.first_name} {lead.last_name}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {lead.portfolio_size ? formatCurrency(lead.portfolio_size) : 'N/A'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                            {lead.pain_points || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {lead.created_at ? formatDate(lead.created_at) : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => handleTakeOver(lead.conversation_id)}
                              className="text-blue-600 hover:text-blue-900 mr-4"
                            >
                              Take Over
                            </button>
                            {lead.booking_link && (
                              <a
                                href={lead.booking_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-600 hover:text-green-900"
                              >
                                Booking Link
                              </a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {selectedTab === 'overrides' && (
              <div>
                <h3 className="text-lg font-medium mb-4">Human Override Required</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Instagram User
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Stage
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Last Updated
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {humanOverrideLeads.map((lead) => (
                        <tr key={lead.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="font-medium text-gray-900">
                                @{lead.instagram_username}
                              </div>
                              <div className="text-sm text-gray-500">
                                {lead.first_name} {lead.last_name}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800">
                              {lead.stage}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {lead.updated_at ? formatDate(lead.updated_at) : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => handleManualTrigger(lead.conversation_id)}
                              className="text-blue-600 hover:text-blue-900 mr-4"
                            >
                              Restart AI
                            </button>
                            <button
                              onClick={() => handleTakeOver(lead.conversation_id)}
                              className="text-green-600 hover:text-green-900"
                            >
                              Take Over
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 