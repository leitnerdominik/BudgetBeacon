namespace BudgetBeacon.Core.Models;

public enum SpendingFlexibilityOverride
{
    Essential,
    Optimizable,
    Optional,
    Unclassified
}

// No change object means the caller omitted the field. A change with no value clears the override.
public readonly record struct SpendingFlexibilityOverrideChange(SpendingFlexibilityOverride? Value);
