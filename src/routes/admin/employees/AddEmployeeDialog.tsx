import React, { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { addEmployee } from '../../../lib/firestore';
import { toast } from 'sonner';
import { useSettings } from '../../../context/SettingsContext';

interface AddEmployeeDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddEmployeeDialog: React.FC<AddEmployeeDialogProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const { currencySymbol } = useSettings();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    empId: '',
    monthlySalary: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    // Validation
    if (!formData.email || !formData.name || !formData.empId || !formData.monthlySalary) {
      toast.error('All fields are required');
      return;
    }

    const salary = parseFloat(formData.monthlySalary);
    if (isNaN(salary) || salary <= 0) {
      toast.error('Please enter a valid monthly salary');
      return;
    }

    try {
      setLoading(true);
      
      // Generate a UID from email (in production, this would be the Firebase Auth UID)
      // For now, we'll use a simple hash of the email
      const uid = formData.email.replace(/[^a-zA-Z0-9]/g, '_');

      await addEmployee(
        uid,
        formData.email,
        formData.name,
        formData.empId,
        salary,
        user.uid
      );

      toast.success('Employee added successfully');
      onSuccess();
    } catch (error: any) {
      console.error('Error adding employee:', error);
      toast.error(error.message || 'Failed to add employee');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent onClose={onClose}>
        <DialogHeader>
          <DialogTitle>Add New Employee</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="employee@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="John Doe"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="empId">Employee ID *</Label>
            <Input
              id="empId"
              value={formData.empId}
              onChange={(e) => setFormData({ ...formData, empId: e.target.value })}
              placeholder="EMP001"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="salary">Monthly Salary ({currencySymbol}) *</Label>
            <Input
              id="salary"
              type="number"
              value={formData.monthlySalary}
              onChange={(e) => setFormData({ ...formData, monthlySalary: e.target.value })}
              placeholder="50000"
              min="0"
              step="1"
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Employee'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
