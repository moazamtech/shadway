'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent } from '@/components/ui/card';
import { MoreHorizontal, ExternalLink, Eye, Check, X, Trash2 } from 'lucide-react';
import { Submission } from '@/lib/types';

interface SubmissionsTableProps {
  submissions: Submission[];
  onStatusUpdate: (id: string, status: 'approved' | 'rejected') => void;
  onDelete: (id: string) => void;
}

export function SubmissionsTable({ submissions, onStatusUpdate, onDelete }: SubmissionsTableProps) {
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (submissions.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="text-center space-y-2">
            <p className="text-lg font-medium text-muted-foreground">No submissions yet</p>
            <p className="text-sm text-muted-foreground">
              Submissions will appear here when users submit their websites
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Website</TableHead>
              <TableHead>Submitter</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {submissions.map((submission) => (
              <TableRow key={submission._id}>
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-medium">{submission.websiteName}</div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <ExternalLink className="w-3 h-3" />
                      <a
                        href={submission.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {new URL(submission.websiteUrl).hostname}
                      </a>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-medium">{submission.name}</div>
                    <div className="text-sm text-muted-foreground">{submission.email}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {submission.category}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`capitalize ${getStatusColor(submission.status)}`}
                  >
                    {submission.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(submission.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => setSelectedSubmission(submission)}
                        className="cursor-pointer"
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      {submission.status === 'pending' && (
                        <>
                          <DropdownMenuItem
                            onClick={() => onStatusUpdate(submission._id!, 'approved')}
                            className="cursor-pointer text-green-600"
                          >
                            <Check className="mr-2 h-4 w-4" />
                            Approve
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onStatusUpdate(submission._id!, 'rejected')}
                            className="cursor-pointer text-red-600"
                          >
                            <X className="mr-2 h-4 w-4" />
                            Reject
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuItem
                        onClick={() => onDelete(submission._id!)}
                        className="cursor-pointer text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Submission Details Modal/Dialog would go here */}
      {selectedSubmission && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <h3 className="text-lg font-semibold">{selectedSubmission.websiteName}</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedSubmission(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Submitter</label>
                    <p>{selectedSubmission.name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Email</label>
                    <p>{selectedSubmission.email}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Category</label>
                    <p className="capitalize">{selectedSubmission.category}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Status</label>
                    <Badge
                      variant="outline"
                      className={`capitalize ${getStatusColor(selectedSubmission.status)}`}
                    >
                      {selectedSubmission.status}
                    </Badge>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Website URL</label>
                  <div className="flex items-center gap-2">
                    <a
                      href={selectedSubmission.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {selectedSubmission.websiteUrl}
                    </a>
                    <ExternalLink className="w-4 h-4" />
                  </div>
                </div>

                {selectedSubmission.githubUrl && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">GitHub URL</label>
                    <div className="flex items-center gap-2">
                      <a
                        href={selectedSubmission.githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {selectedSubmission.githubUrl}
                      </a>
                      <ExternalLink className="w-4 h-4" />
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Description</label>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{selectedSubmission.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                  <div>
                    <label className="font-medium">Submitted</label>
                    <p>{formatDate(selectedSubmission.createdAt)}</p>
                  </div>
                  <div>
                    <label className="font-medium">Last Updated</label>
                    <p>{formatDate(selectedSubmission.updatedAt)}</p>
                  </div>
                </div>

                {selectedSubmission.status === 'pending' && (
                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={() => {
                        onStatusUpdate(selectedSubmission._id!, 'approved');
                        setSelectedSubmission(null);
                      }}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      onClick={() => {
                        onStatusUpdate(selectedSubmission._id!, 'rejected');
                        setSelectedSubmission(null);
                      }}
                      variant="destructive"
                    >
                      <X className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}