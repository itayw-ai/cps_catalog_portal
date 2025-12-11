"""
Validation functions for CPS catalog fields.
"""
import re
from typing import Tuple, Optional


def validate_cves(value: str) -> Tuple[bool, Optional[str]]:
    """
    Validate potential_cves - accepts JSON array or comma-separated list of CVE-YYYY-NNNN format.
    Returns (is_valid, error_message)
    """
    if not value or not value.strip():
        return True, None  # Empty is valid
    
    # Pattern: CVE-YYYY-NNNN (where YYYY is year, NNNN is at least 4 digits)
    cve_pattern = re.compile(r'CVE-\d{4}-\d{4,}')
    
    # Try parsing as JSON first
    try:
        import json
        parsed = json.loads(value)
        if isinstance(parsed, list):
            # Validate each CVE in the array
            for item in parsed:
                if isinstance(item, dict):
                    cve = item.get('cve', item.get('CVE', ''))
                else:
                    cve = str(item)
                if cve and not cve_pattern.match(cve.strip()):
                    return False, f"Invalid CVE format: {cve}. Expected format: CVE-YYYY-NNNN"
            return True, None
    except (json.JSONDecodeError, TypeError):
        pass
    
    # Fallback to comma-separated format
    cves = [cve.strip() for cve in value.split(',')]
    for cve in cves:
        if cve and not cve_pattern.match(cve):
            return False, f"Invalid CVE format: {cve}. Expected format: CVE-YYYY-NNNN"
    
    return True, None


def validate_url(value: str) -> Tuple[bool, Optional[str]]:
    """
    Validate that value looks like a URL.
    Returns (is_valid, error_message)
    """
    if not value or not value.strip():
        return True, None  # Empty is valid
    
    url_pattern = re.compile(
        r'^https?://'  # http:// or https://
        r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain...
        r'localhost|'  # localhost...
        r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
        r'(?::\d+)?'  # optional port
        r'(?:/?|[/?]\S+)$', re.IGNORECASE)
    
    if url_pattern.match(value):
        return True, None
    return False, "Invalid URL format"


def validate_enum(value: str, valid_values: list) -> Tuple[bool, Optional[str]]:
    """
    Validate that value is in the list of valid enum values.
    Returns (is_valid, error_message)
    """
    if not value or not value.strip():
        return True, None  # Empty is valid
    
    if value in valid_values:
        return True, None
    return False, f"Invalid value. Must be one of: {', '.join(valid_values)}"


def validate_is_eol(value: str) -> Tuple[bool, Optional[str]]:
    """Validate is_eol field."""
    return validate_enum(value, ['Active', 'EOL'])


def validate_certified_patches(value: str) -> Tuple[bool, Optional[str]]:
    """
    Validate certified_patches - accepts JSON array format.
    Returns (is_valid, error_message)
    """
    if not value or not value.strip():
        return True, None  # Empty is valid
    
    # Try parsing as JSON
    try:
        import json
        parsed = json.loads(value)
        if isinstance(parsed, list):
            # Validate that items have kb or link
            for item in parsed:
                if not isinstance(item, dict):
                    return False, "Each patch item must be an object with 'kb' and/or 'link' fields"
                if not item.get('kb') and not item.get('link'):
                    return False, "Each patch item must have at least 'kb' or 'link' field"
            return True, None
    except (json.JSONDecodeError, TypeError):
        # If not JSON, accept as plain text (legacy format)
        return True, None
    
    return True, None


def validate_pre_installed_applications(value: str) -> Tuple[bool, Optional[str]]:
    """
    Validate pre_installed_applications - accepts JSON array format.
    Returns (is_valid, error_message)
    """
    if not value or not value.strip():
        return True, None  # Empty is valid
    
    # Try parsing as JSON
    try:
        import json
        parsed = json.loads(value)
        if isinstance(parsed, list):
            # Validate that items have app and relevance
            for item in parsed:
                if not isinstance(item, dict):
                    return False, "Each app item must be an object with 'app' and 'relevance' fields"
                if not item.get('app'):
                    return False, "Each app item must have an 'app' field"
                if item.get('relevance') not in ['Relevant', 'Irrelevant']:
                    return False, "Relevance must be either 'Relevant' or 'Irrelevant'"
            return True, None
    except (json.JSONDecodeError, TypeError):
        # If not JSON, accept as plain text (legacy format)
        return True, None
    
    return True, None


def validate_patching_responsibility(value: str) -> Tuple[bool, Optional[str]]:
    """Validate patching_responsibility field."""
    return validate_enum(value, ['Vendor', 'User', 'Shared'])


def validate_field(field_name: str, value: str) -> Tuple[bool, Optional[str]]:
    """
    Validate a field based on its name.
    Returns (is_valid, error_message)
    """
    validators = {
        'potential_cves': validate_cves,
        'links': validate_url,
        'image_url': validate_url,
        'is_eol': validate_is_eol,
        'certified_patches': validate_certified_patches,
        'pre_installed_applications': validate_pre_installed_applications,
        'patching_responsibility': validate_patching_responsibility,
    }
    
    validator = validators.get(field_name)
    if validator:
        return validator(value)
    
    return True, None  # No validation for other fields

