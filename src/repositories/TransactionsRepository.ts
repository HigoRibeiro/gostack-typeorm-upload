import { EntityRepository, Repository } from 'typeorm';

import Transaction from '../models/Transaction';

interface Balance {
  income: number;
  outcome: number;
  total: number;
}

@EntityRepository(Transaction)
class TransactionsRepository extends Repository<Transaction> {
  public async getBalance(): Promise<Balance> {
    const transactions = await this.find();

    const balance: Balance = transactions.reduce(
      (prev, transaction) => {
        prev[transaction.type] += Number(transaction.value);
        prev.total = prev.income - prev.outcome;

        return prev;
      },
      {
        income: 0,
        outcome: 0,
        total: 0,
      } as Balance,
    );

    return balance;
  }
}

export default TransactionsRepository;
