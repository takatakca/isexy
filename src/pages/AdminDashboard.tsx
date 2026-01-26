import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, TicketIcon, Clock, CheckCircle, AlertCircle, TrendingUp, Users, Shield } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

interface TicketStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  avgResponseTime: number;
  resolutionRate: number;
}

interface CategoryStats {
  name: string;
  count: number;
}

interface DailyStats {
  date: string;
  tickets: number;
  resolved: number;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))', 'hsl(var(--destructive))'];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<TicketStats>({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0,
    avgResponseTime: 0,
    resolutionRate: 0,
  });
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [priorityStats, setPriorityStats] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => {
    checkAdminAndFetchStats();
  }, []);

  const checkAdminAndFetchStats = async () => {
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
        .eq('role', 'admin')
        .single();

      if (!roleData) {
        navigate('/');
        return;
      }

      await fetchAllStats();
    } catch (error) {
      console.error('Error:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllStats = async () => {
    const { data: tickets } = await supabase
      .from('support_tickets')
      .select('*');

    if (!tickets) return;

    // Calculate basic stats
    const open = tickets.filter(t => t.status === 'open').length;
    const inProgress = tickets.filter(t => t.status === 'in_progress').length;
    const resolved = tickets.filter(t => t.status === 'resolved').length;
    const closed = tickets.filter(t => t.status === 'closed').length;

    // Calculate average response time (in hours)
    const respondedTickets = tickets.filter(t => t.responded_at);
    const avgResponseTime = respondedTickets.length > 0
      ? respondedTickets.reduce((acc, t) => {
          const created = new Date(t.created_at).getTime();
          const responded = new Date(t.responded_at!).getTime();
          return acc + (responded - created) / (1000 * 60 * 60);
        }, 0) / respondedTickets.length
      : 0;

    // Calculate resolution rate
    const resolutionRate = tickets.length > 0
      ? ((resolved + closed) / tickets.length) * 100
      : 0;

    setStats({
      total: tickets.length,
      open,
      inProgress,
      resolved,
      closed,
      avgResponseTime: Math.round(avgResponseTime * 10) / 10,
      resolutionRate: Math.round(resolutionRate),
    });

    // Category stats
    const catCounts: Record<string, number> = {};
    tickets.forEach(t => {
      catCounts[t.category] = (catCounts[t.category] || 0) + 1;
    });
    setCategoryStats(Object.entries(catCounts).map(([name, count]) => ({ name, count })));

    // Priority stats
    const prioCounts: Record<string, number> = { low: 0, medium: 0, high: 0, urgent: 0 };
    tickets.forEach(t => {
      prioCounts[t.priority] = (prioCounts[t.priority] || 0) + 1;
    });
    setPriorityStats([
      { name: 'Low', value: prioCounts.low },
      { name: 'Medium', value: prioCounts.medium },
      { name: 'High', value: prioCounts.high },
      { name: 'Urgent', value: prioCounts.urgent },
    ]);

    // Daily stats (last 7 days)
    const last7Days: DailyStats[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayTickets = tickets.filter(t => t.created_at.startsWith(dateStr));
      const dayResolved = tickets.filter(t => 
        (t.status === 'resolved' || t.status === 'closed') && 
        t.updated_at.startsWith(dateStr)
      );
      last7Days.push({
        date: date.toLocaleDateString('en-US', { weekday: 'short' }),
        tickets: dayTickets.length,
        resolved: dayResolved.length,
      });
    }
    setDailyStats(last7Days);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card border-b border-border px-4 py-4">
        <div className="flex items-center gap-3 max-w-7xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/tickets')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">Admin Dashboard</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <TicketIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Tickets</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/10 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.open}</p>
                  <p className="text-xs text-muted-foreground">Open Tickets</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.resolutionRate}%</p>
                  <p className="text-xs text-muted-foreground">Resolution Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Clock className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.avgResponseTime}h</p>
                  <p className="text-xs text-muted-foreground">Avg Response</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Status Breakdown */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-card border border-border rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-yellow-500">{stats.open}</p>
            <p className="text-xs text-muted-foreground">Open</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-blue-500">{stats.inProgress}</p>
            <p className="text-xs text-muted-foreground">In Progress</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-green-500">{stats.resolved}</p>
            <p className="text-xs text-muted-foreground">Resolved</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-muted-foreground">{stats.closed}</p>
            <p className="text-xs text-muted-foreground">Closed</p>
          </div>
        </div>

        <Tabs defaultValue="volume" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="volume" className="flex-1">Volume</TabsTrigger>
            <TabsTrigger value="categories" className="flex-1">Categories</TabsTrigger>
            <TabsTrigger value="priority" className="flex-1">Priority</TabsTrigger>
          </TabsList>

          <TabsContent value="volume">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ticket Volume (Last 7 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }} 
                      />
                      <Line type="monotone" dataKey="tickets" stroke="hsl(var(--primary))" strokeWidth={2} name="New Tickets" />
                      <Line type="monotone" dataKey="resolved" stroke="hsl(var(--accent))" strokeWidth={2} name="Resolved" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tickets by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryStats} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} width={100} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }} 
                      />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="priority">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tickets by Priority</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={priorityStats}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {priorityStats.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }} 
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Button onClick={() => navigate('/admin/tickets')} className="w-full">
            <TicketIcon className="h-4 w-4 mr-2" />
            Manage Tickets
          </Button>
          <Button variant="outline" onClick={() => navigate('/admin/categories')} className="w-full">
            <Users className="h-4 w-4 mr-2" />
            Manage Categories
          </Button>
          <Button variant="outline" onClick={() => navigate('/admin/verifications')} className="w-full">
            <Shield className="h-4 w-4 mr-2" />
            Cuban Verifications
          </Button>
          <Button variant="outline" onClick={() => navigate('/admin/analytics')} className="w-full">
            <TrendingUp className="h-4 w-4 mr-2" />
            Full Analytics
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
