import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import FlightTakeoffIcon from "@mui/icons-material/FlightTakeoff";
import HealthAndSafetyIcon from "@mui/icons-material/HealthAndSafety";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import HomeIcon from "@mui/icons-material/Home";
import LocalMallIcon from "@mui/icons-material/LocalMall";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import PaymentsIcon from "@mui/icons-material/Payments";
import RestaurantIcon from "@mui/icons-material/Restaurant";
import SavingsIcon from "@mui/icons-material/Savings";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import SubscriptionsIcon from "@mui/icons-material/Subscriptions";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";

export const transactionCategoryOptions = [
  {
    value: "Income",
    description: "Salary, freelance, gifts, refunds, interest",
    Icon: PaymentsIcon,
  },
  {
    value: "Housing & Utilities",
    description: "Rent, mortgage, electricity, heating, water",
    Icon: HomeIcon,
  },
  {
    value: "Food & Groceries",
    description: "Supermarkets, groceries, basic food",
    Icon: ShoppingCartIcon,
  },
  {
    value: "Eating Out",
    description: "Restaurants, cafes, bars, delivery",
    Icon: RestaurantIcon,
  },
  {
    value: "Transport",
    description: "Fuel, public transport, car costs, bike repairs",
    Icon: DirectionsCarIcon,
  },
  {
    value: "Health & Insurance",
    description: "Doctor, medicine, health insurance, liability insurance",
    Icon: HealthAndSafetyIcon,
  },
  {
    value: "Shopping & Personal",
    description: "Clothes, electronics, household items, haircuts",
    Icon: LocalMallIcon,
  },
  {
    value: "Leisure & Hobbies",
    description: "Sports, skateboarding, climbing, games, cinema",
    Icon: SportsEsportsIcon,
  },
  {
    value: "Travel",
    description: "Hotels, flights, trains, vacation spending",
    Icon: FlightTakeoffIcon,
  },
  {
    value: "Subscriptions & Services",
    description: "Netflix, Spotify, cloud services, phone, internet",
    Icon: SubscriptionsIcon,
  },
  {
    value: "Savings & Investments",
    description: "ETFs, savings account, pension, crypto",
    Icon: SavingsIcon,
  },
  {
    value: "Transfers & Adjustments",
    description: "Internal transfers, credit card payments, refunds, corrections",
    Icon: SwapHorizIcon,
  },
  {
    value: "Other",
    description: "Transactions that do not fit another category",
    Icon: MoreHorizIcon,
  },
] as const;

export const transactionCategories = transactionCategoryOptions.map(
  (option) => option.value,
);

export type TransactionCategory =
  (typeof transactionCategoryOptions)[number]["value"];

const uncategorizedOption = {
  value: "Uncategorized",
  description: "Transactions waiting for review or automatic categorization",
  Icon: HelpOutlineIcon,
} as const;

export const getTransactionCategoryOption = (category: string) =>
  transactionCategoryOptions.find((option) => option.value === category) ??
  uncategorizedOption;
