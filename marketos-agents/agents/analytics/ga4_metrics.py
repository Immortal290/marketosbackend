"""Validated, read-only GA4 metrics for the AnalyticsAgent."""

import re


def normalize_ga4_summary(value):
    if value is None:
        return None

    if not isinstance(value, dict):
        raise ValueError("Invalid GA4 summary")

    required = {
        "provider",
        "propertyId",
        "period",
        "activeUsers",
        "sessions",
    }

    if set(value) != required:
        raise ValueError("Invalid GA4 summary fields")

    if value["provider"] != "ga4":
        raise ValueError("Invalid analytics provider")

    if value["period"] != "last_7_complete_days":
        raise ValueError("Invalid GA4 reporting period")

    property_id = value["propertyId"]

    if (
        not isinstance(property_id, str)
        or not re.fullmatch(
            r"properties/[1-9][0-9]{0,18}",
            property_id,
        )
    ):
        raise ValueError("Invalid GA4 property")

    for field in ("activeUsers", "sessions"):
        count = value[field]

        if (
            type(count) is not int
            or count < 0
            or count > 9007199254740991
        ):
            raise ValueError("Invalid GA4 metric")

    return {
        "provider": "ga4",
        "propertyId": property_id,
        "period": "last_7_complete_days",
        "activeUsers": value["activeUsers"],
        "sessions": value["sessions"],
    }


def format_ga4_context(summary):
    if summary is None:
        return ""

    return (
        "\nSEPARATE DATA SOURCE: GOOGLE ANALYTICS 4\n"
        f"GA4 Property: {summary['propertyId']}\n"
        "Period: Last 7 complete days\n"
        f"Active Users: {summary['activeUsers']:,}\n"
        f"Sessions: {summary['sessions']:,}\n"
        "IMPORTANT: These metrics describe website activity, "
        "not email campaign delivery. Analyze them separately "
        "from ClickHouse campaign metrics. Do not assume "
        "that email activity caused these website results.\n"
    )