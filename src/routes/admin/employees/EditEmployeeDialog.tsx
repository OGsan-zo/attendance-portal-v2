import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { updateEmployee } from '../../../lib/firestore';
import { Employee } from '../../../types';
import { toast } from 'sonner';
import { useSettings } from '../../../context/SettingsContext';

interface EditEmployeeDialogProps {
  employee: Employee;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditEmployeeDialog: React.FC<EditEmployeeDialogProps> = ({
  employee,
  open,
  onClose,
  onSuccess,
}) => {
  const { currencySymbol } = useSettings();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: employee.name,
    empId: employee.empId,
    monthlySalary: employee.monthlySalary.toString(),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.name || !formData.empId || !formData.monthlySalary) {
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
      
      await updateEmployee(employee.uid, {
        name: formData.name,
        empId: formData.empId,
        monthlySalary: salary,
      });

      toast.success('Employee updated successfully');
      onSuccess();
    } catch (error: any) {
      console.error('Error updating employee:', error);
      toast.error(error.message || 'Failed to update employee');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent onClose={onClose}>
        <DialogHeader>
          <DialogTitle>Edit Employee</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={employee.email}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">Email cannot be changed</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="empId">Employee ID *</Label>
            <Input
              id="empId"
              value={formData.empId}
              onChange={(e) => setFormData({ ...formData, empId: e.target.value })}
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
              {loading ? 'Updating...' : 'Update Employee'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
