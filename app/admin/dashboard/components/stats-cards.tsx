import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Globe,
  BarChart,
  Users,
  Activity,
  TrendingUp,
  FileText,
  Clock
} from 'lucide-react';

interface StatsCardsProps {
  stats: {
    totalSites: number;
    featuredSites: number;
    categoriesCount: number;
    recentlyAdded: number;
    totalSubmissions: number;
    pendingSubmissions: number;
  };
}

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 mb-8">
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
            <BarChart className="h-4 w-4 text-green-600 dark:text-green-400" />
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
            <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
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
            <Activity className="h-4 w-4 text-orange-600 dark:text-orange-400" />
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
            <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />
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
            <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
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
  );
}