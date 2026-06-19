import BoltIcon from "@mui/icons-material/Bolt";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import HomeIcon from "@mui/icons-material/Home";
import LocalMallIcon from "@mui/icons-material/LocalMall";
import MedicalServicesIcon from "@mui/icons-material/MedicalServices";
import MovieIcon from "@mui/icons-material/Movie";
import PaymentsIcon from "@mui/icons-material/Payments";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import SubscriptionsIcon from "@mui/icons-material/Subscriptions";
import WaterDropIcon from "@mui/icons-material/WaterDrop";

export const transactionCategoryOptions = [
  { value: "Transport", Icon: DirectionsCarIcon },
  { value: "Energy", Icon: BoltIcon },
  { value: "Groceries", Icon: ShoppingCartIcon },
  { value: "Lifestyle", Icon: LocalMallIcon },
  { value: "Housing", Icon: HomeIcon },
  { value: "Utilities", Icon: WaterDropIcon },
  { value: "Entertainment", Icon: MovieIcon },
  { value: "Health", Icon: MedicalServicesIcon },
  { value: "Subscriptions", Icon: SubscriptionsIcon },
  { value: "Income", Icon: PaymentsIcon },
  { value: "Uncategorized", Icon: HelpOutlineIcon },
] as const;

export const transactionCategories = transactionCategoryOptions.map(
  (option) => option.value,
);

export type TransactionCategory =
  (typeof transactionCategoryOptions)[number]["value"];

const uncategorizedOption = transactionCategoryOptions.find(
  (option) => option.value === "Uncategorized",
)!;

export const getTransactionCategoryOption = (category: string) =>
  transactionCategoryOptions.find((option) => option.value === category) ??
  uncategorizedOption;
