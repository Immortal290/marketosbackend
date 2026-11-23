import unittest

from agents.analytics.ga4_metrics import (
    normalize_ga4_summary,
    format_ga4_context,
)


VALID = {
    "provider": "ga4",
    "propertyId": "properties/123",
    "period": "last_7_complete_days",
    "activeUsers": 42,
    "sessions": 64,
}


class GA4MetricsTests(unittest.TestCase):
    def test_valid_summary(self):
        self.assertEqual(
            normalize_ga4_summary(VALID),
            VALID,
        )

    def test_missing_summary_is_optional(self):
        self.assertIsNone(normalize_ga4_summary(None))

    def test_rejects_extra_fields_including_tokens(self):
        with self.assertRaises(ValueError):
            normalize_ga4_summary({
                **VALID,
                "accessToken": "private-token",
            })

    def test_rejects_invalid_property(self):
        with self.assertRaises(ValueError):
            normalize_ga4_summary({
                **VALID,
                "propertyId": "https://untrusted.example",
            })

    def test_rejects_invalid_counts(self):
        for count in (-1, True, "42", 1.5):
            with self.subTest(count=count):
                with self.assertRaises(ValueError):
                    normalize_ga4_summary({
                        **VALID,
                        "activeUsers": count,
                    })

    def test_ga4_is_distinguished_from_email_metrics(self):
        context = format_ga4_context(VALID)

        self.assertIn("Active Users: 42", context)
        self.assertIn("Sessions: 64", context)
        self.assertIn("not email campaign delivery", context)

    def test_no_token_in_formatted_context(self):
        context = format_ga4_context(VALID)

        self.assertNotIn("accessToken", context)
        self.assertNotIn("Authorization", context)


if __name__ == "__main__":
    unittest.main()