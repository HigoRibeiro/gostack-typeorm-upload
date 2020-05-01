import { getRepository, In, getCustomRepository } from 'typeorm';
import csvParse from 'csv-parse';
import { Duplex } from 'stream';
import Transaction from '../models/Transaction';
import Category from '../models/Category';
import TransactionsRepository from '../repositories/TransactionsRepository';

interface Request {
  content: Buffer;
}

interface CategoryDict {
  [key: string]: string;
}

interface TransactionDTO {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category_id: string;
}

class ImportTransactionsService {
  async execute({ content }: Request): Promise<Transaction[]> {
    const parserStream = csvParse({
      from_line: 2,
      trim: true,
      skip_lines_with_empty_values: true,
      columns: ['title', 'type', 'value', 'category'],
    });

    const stream = new Duplex();
    stream.push(content);
    stream.push(null);

    const parseCSV = stream.pipe(parserStream);

    const lines: Array<TransactionDTO> = [];

    const categoriesParsed: CategoryDict = {};

    parseCSV.on('data', ({ category, ...line }) => {
      categoriesParsed[category] = '';
      lines.push({ ...line, category_id: category });
    });

    await new Promise(resolve => parseCSV.on('end', resolve));

    const transactionsRepository = getCustomRepository(TransactionsRepository);
    const categoriesRepository = getRepository<Category>('categories');

    const categories = await categoriesRepository.find({
      where: {
        title: In(Object.keys(categoriesParsed)),
      },
    });

    const categoryTiles = categories.map(category => category.title);

    const newCategoriesData = Object.keys(categoriesParsed).reduce<
      CategoryDict[]
    >((prev, category) => {
      if (!categoryTiles.includes(category)) {
        prev.push({ title: category });
      }

      return prev;
    }, []);

    const newCategories = categoriesRepository.create(newCategoriesData);

    await categoriesRepository.save(newCategories);

    [...categories, ...newCategories].forEach(category => {
      categoriesParsed[category.title] = category.id;
    });

    const data = lines.map(line => ({
      ...line,
      category_id: categoriesParsed[line.category_id],
    }));

    const transactions = transactionsRepository.create(data);

    await transactionsRepository.save(transactions);

    return transactions;
  }
}

export default ImportTransactionsService;
