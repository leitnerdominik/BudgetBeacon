import type { SvgIconProps } from "@mui/material/SvgIcon";

import { getTransactionCategoryOption } from "../transactionCategories";

type TransactionCategoryIconProps = SvgIconProps & {
  category: string;
};

export const TransactionCategoryIcon = ({
  category,
  ...iconProps
}: TransactionCategoryIconProps) => {
  const { Icon } = getTransactionCategoryOption(category);

  return <Icon {...iconProps} />;
};
