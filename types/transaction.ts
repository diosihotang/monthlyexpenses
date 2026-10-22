export type TransactionType = 'income' | 'expense';

export type Category = 
  | 'Salary' | 'Freelance' | 'Business' | 'Investment' // Income
  | 'Food' | 'Entertainment' | 'Shopping' | 'Transport' | 'Utilities' | 'Other'; // Expense

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  category: Category;
  type: TransactionType;
  description: string;
  status: 'success' | 'pending';
}

export interface FinancialSummary {
  monthlyIncome: number;
  monthlyExpenses: number;
  spendingLimit: number;
  usedAmount: number;
}
