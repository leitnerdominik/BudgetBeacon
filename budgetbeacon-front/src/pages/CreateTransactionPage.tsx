import { TransactionForm } from "../features/transactions/components/TransactionForm";

type CreateTransactionPageProps = {
  mode?: "standard" | "quick";
};

export const CreateTransactionPage = ({
  mode = "standard",
}: CreateTransactionPageProps) => <TransactionForm mode={mode} />;
