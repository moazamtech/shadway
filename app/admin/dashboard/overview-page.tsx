'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  ArrowRight,
  Calendar,
  ExternalLink,
  FileText,
  Globe,
  TrendingUp,
  Users
} from 'lucide-react';
import { Website, Submission } from '@/lib/types';
import { AdminLayout } from '../components';

interface DashboardStats {
  totalSites: number;
  featuredSites: number;
  categoriesCount: number;
  recentlyAdded: number;
  totalSubmissions: number;
  pendingSubmissions: number;
}

export default function OverviewPage() {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  // Computed stats
  const stats: DashboardStats = useMemo(() => {
    const recentlyAdded = websites.filter(website => {
      const addedDate = new Date(website.createdAt || Date.now());
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return addedDate > weekAgo;
    }).length;

    return {
      totalSites: websites.length,
      featuredSites: websites.filter(w => w.featured).length,
      categoriesCount: new Set(websites.map(w => w.category)).size,
      recentlyAdded,
      totalSubmissions: submissions.length,
      pendingSubmissions: submissions.filter(s => s.status === 'pending').length
    };
  }, [websites, submissions]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [websitesRes, submissionsRes] = await Promise.all([
        fetch('/api/websites'),
        fetch('/api/submissions')
      ]);

      if (websitesRes.ok) {
        const websitesData = await websitesRes.json();
        setWebsites(websitesData);
      }

      if (submissionsRes.ok) {
        const submissionsData = await submissionsRes.json();
        setSubmissions(submissionsData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Recent websites (last 5)
  const recentWebsites = useMemo(() => {
    return websites
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 5);
  }, [websites]);

  // Recent submissions (last 5)
  const recentSubmissions = useMemo(() => {
    return submissions
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 5);
  }, [submissions]);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="flex flex-col items-center gap-2">
            <Activity className="h-8 w-8 animate-pulse text-primary" />
            <p className="text-sm text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's what's happening with your platform.
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Websites</CardTitle>
              <div className="rounded-lg bg-primary/10 p-2">
                <Globe className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalSites}</div>
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                <TrendingUp className="h-3 w-3 mr-1" />
                Active sites
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Featured Sites</CardTitle>
              <div className="rounded-lg bg-green-500/10 p-2">
                <Activity className="h-4 w-4 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.featuredSites}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {((stats.featuredSites / stats.totalSites) * 100 || 0).toFixed(1)}% of total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Categories</CardTitle>
              <div className="rounded-lg bg-blue-500/10 p-2">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.categoriesCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Unique categories</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Recently Added</CardTitle>
              <div className="rounded-lg bg-orange-500/10 p-2">
                <Calendar className="h-4 w-4 text-orange-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.recentlyAdded}</div>
              <p className="text-xs text-muted-foreground mt-1">Last 7 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Submissions</CardTitle>
              <div className="rounded-lg bg-purple-500/10 p-2">
                <FileText className="h-4 w-4 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalSubmissions}</div>
              <p className="text-xs text-muted-foreground mt-1">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Review</CardTitle>
              <div className="rounded-lg bg-yellow-500/10 p-2">
                <Activity className="h-4 w-4 text-yellow-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingSubmissions}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.totalSubmissions > 0
                  ? `${((stats.pendingSubmissions / stats.totalSubmissions) * 100).toFixed(1)}% of total`
                  : 'No submissions yet'
                }
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Button asChild className="h-20 flex flex-col gap-2">
            <Link href="/admin/websites">
              <Globe className="h-5 w-5" />
              Manage Websites
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-20 flex flex-col gap-2">
            <Link href="/admin/submissions">
              <FileText className="h-5 w-5" />
              Review Submissions
              {stats.pendingSubmissions > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {stats.pendingSubmissions} pending
                </Badge>
              )}
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-20 flex flex-col gap-2">
            <Link href="/admin/analytics">
              <Activity className="h-5 w-5" />
              View Analytics
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-20 flex flex-col gap-2">
            <Link href="/admin/settings">
              <Users className="h-5 w-5" />
              Settings
            </Link>
          </Button>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Websites */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Recent Websites</CardTitle>
                <CardDescription>Latest websites added to the platform</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/websites" className="flex items-center gap-1">
                  View All
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentWebsites.length > 0 ? (
                recentWebsites.map((website) => (
                  <div key={website._id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="space-y-1">
                      <p className="font-medium">{website.name}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {website.category}
                        </Badge>
                        {website.featured && (
                          <Badge variant="secondary" className="text-xs">
                            Featured
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <a href={website.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-8">No websites added yet</p>
              )}
            </CardContent>
          </Card>

          {/* Recent Submissions */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Recent Submissions</CardTitle>
                <CardDescription>Latest website submissions from users</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/submissions" className="flex items-center gap-1">
                  View All
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentSubmissions.length > 0 ? (
                recentSubmissions.map((submission) => (
                  <div key={submission._id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="space-y-1">
                      <p className="font-medium">{submission.websiteName}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {submission.category}
                        </Badge>
                        <Badge
                          variant={submission.status === 'pending' ? 'default' :
                                  submission.status === 'approved' ? 'secondary' : 'destructive'}
                          className="text-xs capitalize"
                        >
                          {submission.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">by {submission.name}</p>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <a href={submission.websiteUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-8">No submissions yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}