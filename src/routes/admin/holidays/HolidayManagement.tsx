import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Skeleton } from '../../../components/ui/skeleton';
import { Plus, Trash2 } from 'lucide-react';
import { addHoliday, getMonthHolidays, deleteHoliday, markAllSundaysForYear } from '../../../lib/firestore';
import { getSalaryMonthKey } from "../../../lib/salary";
import { Holiday } from '../../../types';
import { format } from 'date-fns';
import { toast } from 'sonner';

export const HolidayManagement: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reason, setReason] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadHolidays();
  }, []);

  const loadHolidays = async () => {
    try {
      setLoading(true);
      const salaryMonthKey = getSalaryMonthKey();
      const data = await getMonthHolidays(salaryMonthKey);
      setHolidays(data.sort((a, b) => a.date.localeCompare(b.date)));
    } catch (error) {
      toast.error('Failed to load holidays');
    } finally {
      setLoading(false);
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setAdding(true);
      await addHoliday(selectedDate, reason || undefined);
      toast.success('Holiday added successfully');
      setReason('');
      await loadHolidays();
    } catch (error) {
      toast.error('Failed to add holiday');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (date: string, reason?: string) => {
    if (reason === 'Sunday') {
      toast.error('Cannot delete auto-marked Sundays');
      return;
    }

    if (!confirm(`Delete holiday on ${format(new Date(date), 'MMM dd, yyyy')}?`)) return;

    try {
      await deleteHoliday(date);
      toast.success('Holiday deleted');
      await loadHolidays();
    } catch (error) {
      toast.error('Failed to delete holiday');
    }
  };

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Holiday Management</h1>
        <p className="text-muted-foreground">Mark and manage holidays</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Holiday</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddHoliday} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">Reason (Optional)</Label>
                <Input
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., National Holiday"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={adding} className="flex-1">
                <Plus className="mr-2 h-4 w-4" />
                {adding ? 'Adding...' : 'Add Holiday'}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                disabled={adding}
                onClick={async () => {
                  if (!confirm('Are you sure you want to mark all Sundays in the current year as holidays?')) return;
                  try {
                    setAdding(true);
                    await markAllSundaysForYear(new Date().getFullYear());
                    toast.success('All Sundays marked successfully');
                    await loadHolidays();
                  } catch (error) {
                    toast.error('Failed to mark Sundays');
                  } finally {
                    setAdding(false);
                  }
                }}
              >
                Mark All Sundays
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Holidays ({holidays.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holidays.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No holidays found
                  </TableCell>
                </TableRow>
              ) : (
                holidays.map(holiday => (
                  <TableRow key={holiday.date}>
                    <TableCell className="font-medium">
                      {format(new Date(holiday.date), 'MMM dd, yyyy (EEEE)')}
                    </TableCell>
                    <TableCell>{holiday.reason || '-'}</TableCell>
                    <TableCell className="text-right">
                      {holiday.reason !== 'Sunday' && (
                        <Button
                          onClick={() => handleDelete(holiday.date, holiday.reason)}
                          variant="destructive"
                          size="sm"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
