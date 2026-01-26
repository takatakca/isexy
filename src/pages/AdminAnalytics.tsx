import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, Users, Heart, DollarSign, Activity, 
  TrendingUp, UserPlus, MessageSquare, Zap 
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend 
} from "recharts";

interface DashboardStats {
  totalUsers: number;
  newUsersToday: number;
  newUsersWeek: number;
  totalMatches: number;
  matchesToday: number;
  totalMessages: number;
  activeUsers: number;
  premiumUsers: number;
  verifiedUsers: number;
}

interface ChartData {
  date: string;
  signups: number;
  matches: number;
  messages: number;
}

interface GenderData {
  name: string;
  value: number;
}

interface SubscriptionData {
  tier: string;
  count: number;
}

const COLORS = ['hsl(346, 77%, 50%)', 'hsl(45, 93%, 47%)', 'hsl(215, 25%, 35%)', 'hsl(210, 40%, 96%)'];

export default function AdminAnalytics() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    newUsersToday: 0,
    newUsersWeek: 0,
    totalMatches: 0,
    matchesToday: 0,
    totalMessages: 0,
    activeUsers: 0,
    premiumUsers: 0,
    verifiedUsers: 0,
  });
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [genderData, setGenderData] = useState<GenderData[]>([]);
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData[]>([]);
  const [countryData, setCountryData] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => {
    checkAdminAndFetch();
  }, []);

  const checkAdminAndFetch = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['admin', 'moderator'])
        .single();

      if (!roleData) {
        navigate('/');
        return;
      }

      await fetchAllData();
    } catch (error) {
      console.error('Error:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllData = async () => {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Fetch profiles
    const { data: profiles } = await supabase.from('profiles').select('*');
    const { data: matches } = await supabase.from('matches').select('*');
    const { data: messages } = await supabase.from('messages').select('*');
    const { data: subscriptions } = await supabase.from('subscriptions').select('*').eq('status', 'active');

    if (!profiles) return;

    // Calculate stats
    const newUsersToday = profiles.filter(p => p.created_at.startsWith(today)).length;
    const newUsersWeek = profiles.filter(p => p.created_at >= weekAgo).length;
    const matchesToday = matches?.filter(m => m.matched_at.startsWith(today)).length || 0;
    const activeUsers = profiles.filter(p => p.is_active).length;
    const premiumUsers = profiles.filter(p => p.is_premium).length;
    const verifiedUsers = profiles.filter(p => p.is_verified).length;

    setStats({
      totalUsers: profiles.length,
      newUsersToday,
      newUsersWeek,
      totalMatches: matches?.length || 0,
      matchesToday,
      totalMessages: messages?.length || 0,
      activeUsers,
      premiumUsers,
      verifiedUsers,
    });

    // Gender breakdown
    const genderCounts: Record<string, number> = { man: 0, woman: 0, other: 0 };
    profiles.forEach(p => {
      const gender = p.gender?.toLowerCase() || 'other';
      if (gender === 'man' || gender === 'male') genderCounts.man++;
      else if (gender === 'woman' || gender === 'female') genderCounts.woman++;
      else genderCounts.other++;
    });
    setGenderData([
      { name: 'Men', value: genderCounts.man },
      { name: 'Women', value: genderCounts.woman },
      { name: 'Other', value: genderCounts.other },
    ]);

    // Country breakdown
    const countryCounts: Record<string, number> = {};
    profiles.forEach(p => {
      const country = p.country || 'Unknown';
      countryCounts[country] = (countryCounts[country] || 0) + 1;
    });
    setCountryData(
      Object.entries(countryCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5)
    );

    // Subscription tiers
    const tierCounts: Record<string, number> = { plus: 0, gold: 0, platinum: 0 };
    subscriptions?.forEach(s => {
      tierCounts[s.tier] = (tierCounts[s.tier] || 0) + 1;
    });
    setSubscriptionData([
      { tier: 'Plus', count: tierCounts.plus },
      { tier: 'Gold', count: tierCounts.gold },
      { tier: 'Platinum', count: tierCounts.platinum },
    ]);

    // Last 14 days chart data
    const last14Days: ChartData[] = [];
    for (let i = 13; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const signups = profiles.filter(p => p.created_at.startsWith(dateStr)).length;
      const dayMatches = matches?.filter(m => m.matched_at.startsWith(dateStr)).length || 0;
      const dayMessages = messages?.filter(m => m.created_at.startsWith(dateStr)).length || 0;
      
      last14Days.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        signups,
        matches: dayMatches,
        messages: dayMessages,
      });
    }
    setChartData(last14Days);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-4">
        <div className="flex items-center gap-3 max-w-7xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">Analytics Dashboard</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.totalUsers}</p>
                  <p className="text-xs text-muted-foreground">Total Users</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <UserPlus className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">+{stats.newUsersWeek}</p>
                  <p className="text-xs text-muted-foreground">This Week</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-pink-500/10 rounded-lg">
                  <Heart className="h-5 w-5 text-pink-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.totalMatches}</p>
                  <p className="text-xs text-muted-foreground">Total Matches</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <Zap className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.premiumUsers}</p>
                  <p className="text-xs text-muted-foreground">Premium</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-card border border-border rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-green-500">{stats.activeUsers}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-blue-500">{stats.verifiedUsers}</p>
            <p className="text-xs text-muted-foreground">Verified</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-purple-500">{stats.totalMessages}</p>
            <p className="text-xs text-muted-foreground">Messages</p>
          </div>
        </div>

        {/* Charts */}
        <Tabs defaultValue="growth" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="growth" className="flex-1">Growth</TabsTrigger>
            <TabsTrigger value="engagement" className="flex-1">Engagement</TabsTrigger>
            <TabsTrigger value="demographics" className="flex-1">Users</TabsTrigger>
            <TabsTrigger value="revenue" className="flex-1">Revenue</TabsTrigger>
          </TabsList>

          <TabsContent value="growth">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  User Signups (Last 14 Days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }} 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="signups" 
                        stroke="hsl(var(--primary))" 
                        fill="hsl(var(--primary) / 0.2)" 
                        strokeWidth={2}
                        name="Signups"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="engagement">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-5 h-5 text-pink-500" />
                  Matches & Messages
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }} 
                      />
                      <Legend />
                      <Line type="monotone" dataKey="matches" stroke="#ec4899" strokeWidth={2} name="Matches" />
                      <Line type="monotone" dataKey="messages" stroke="#8b5cf6" strokeWidth={2} name="Messages" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="demographics">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Gender Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={genderData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {genderData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top Countries</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={countryData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} width={60} />
                        <Tooltip />
                        <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="revenue">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-500" />
                  Subscriptions by Tier
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={subscriptionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="tier" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }} 
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        <Cell fill="#ec4899" />
                        <Cell fill="#f59e0b" />
                        <Cell fill="#475569" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Revenue Summary */}
                <div className="grid grid-cols-3 gap-3 mt-4">
                  {subscriptionData.map((tier, idx) => {
                    const prices = { Plus: 14.99, Gold: 29.99, Platinum: 39.99 };
                    const mrr = tier.count * (prices[tier.tier as keyof typeof prices] || 0);
                    return (
                      <div key={tier.tier} className="text-center p-3 bg-muted/30 rounded-lg">
                        <p className="text-sm font-semibold text-foreground">{tier.tier}</p>
                        <p className="text-lg font-bold text-foreground">{tier.count}</p>
                        <p className="text-xs text-muted-foreground">${mrr.toFixed(2)} MRR</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button onClick={() => navigate('/admin')} className="w-full">
            <Activity className="h-4 w-4 mr-2" />
            Ticket Dashboard
          </Button>
          <Button variant="outline" onClick={() => navigate('/admin/verifications')} className="w-full">
            <Users className="h-4 w-4 mr-2" />
            Verifications
          </Button>
        </div>
      </div>
    </div>
  );
}
