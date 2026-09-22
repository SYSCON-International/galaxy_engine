import re
from pathlib import Path

from django.test import Client, SimpleTestCase

from documentation_app.views.doc_section_view import get_available_sections

NAV_TEMPLATE = Path(__file__).resolve().parent / "templates" / "documentation_app" / "navigation.html"


class DocumentationSectionsTestCase(SimpleTestCase):
    # This app has no models/DATABASES configured at all (it's static content) -- SimpleTestCase skips the
    # transactional test-database setup that plain TestCase requires, which would otherwise fail immediately.
    """
    Keeps navigation.html's links and the partials/ directory in sync -- the two were allowed to drift apart
    silently for a while (missing partials, and a stale nav link with no matching content), since a broken
    combination doesn't look any different from a working one unless someone clicks every link by hand.
    """

    def get_nav_sections(self):
        nav_html = NAV_TEMPLATE.read_text()

        return set(re.findall(r'href="#([a-z0-9_]+)"', nav_html))

    def test_every_nav_link_has_a_matching_partial(self):
        missing = self.get_nav_sections() - get_available_sections()

        self.assertEqual(missing, set(), f"navigation.html links to sections with no partials/<section>.html file: {sorted(missing)}")

    def test_every_partial_is_registered_in_the_nav(self):
        orphaned = get_available_sections() - self.get_nav_sections()

        self.assertEqual(orphaned, set(), f"partials/ contains files not linked from navigation.html: {sorted(orphaned)}")

    def test_every_documented_section_renders_successfully(self):
        client = Client()

        for section in sorted(self.get_nav_sections()):
            response = client.get(f"/docs/{section}/")

            self.assertEqual(response.status_code, 200, f"/docs/{section}/ did not render successfully (status {response.status_code})")
