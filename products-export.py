#!/usr/bin/env python3
"""
Maeri Shopify Products Variant-Level Data Export
Fetches product data at variant level and exports to CSV
Each variant gets its own row with complete product information
Perfect for inventory management, product analysis, and sales tracking
"""

import requests
import json
import csv
from datetime import datetime
import sys

# Shopify API Configuration
SHOPIFY_DOMAIN = "ab0f6f-61.myshopify.com"
ACCESS_TOKEN = "YOUR_SHOPIFY_ACCESS_TOKEN"
API_VERSION = "2025-07"

def fetch_products_with_variants(limit=250):
    """
    Fetch product with variants data from Shopify GraphQL API
    """
    url = f"https://{SHOPIFY_DOMAIN}/admin/api/{API_VERSION}/graphql.json"
    
    query = """
    query GetProductsWithVariants($first: Int!) {
      products(first: $first) {
        edges {
          node {
            id
            title
            handle
            description
            vendor
            productType
            tags
            status
            createdAt
            updatedAt
            publishedAt
            totalInventory
            totalVariants
            images(first: 1) {
              edges {
                node {
                  url
                }
              }
            }
            variants(first: 50) {
              edges {
                node {
                  id
                  title
                  price
                  sku
                  inventoryQuantity
                }
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
    """
    
    headers = {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": ACCESS_TOKEN
    }
    
    payload = {
        "query": query,
        "variables": {"first": limit}
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching data: {e}")
        return None

def parse_product_variants_data(products_data):
    """
    Parse product + variants data into flat structure for CSV export
    Each row represents one variant with full product information
    """
    if not products_data or 'data' not in products_data:
        return []
    
    product_variants = []
    for edge in products_data['data']['products']['edges']:
        product = edge['node']
        
        # Basic product information
        product_id = product['id'].split('/')[-1]
        product_title = product['title']
        product_handle = product['handle']
        product_description = product['description'] or ''
        vendor = product['vendor']
        product_type = product['productType']
        tags = ', '.join(product['tags']) if product['tags'] else ''
        status = product['status']
        
        # Timestamps
        created_at = product['createdAt']
        updated_at = product['updatedAt']
        published_at = product['publishedAt']
        
        # Inventory info
        total_inventory = product['totalInventory']
        total_variants = product['totalVariants']
        
        # First image URL
        first_image_url = ''
        if product['images']['edges']:
            first_image_url = product['images']['edges'][0]['node']['url']
        
        # Process each variant
        for variant_edge in product['variants']['edges']:
            variant = variant_edge['node']
            
            # Variant information
            variant_id = variant['id'].split('/')[-1]
            variant_title = variant['title']
            variant_price = float(variant['price'])
            variant_sku = variant['sku'] or ''
            variant_inventory_quantity = variant['inventoryQuantity']
            
            product_variants.append({
                # Product Information (repeated for each variant)
                'product_id': product_id,
                'product_title': product_title,
                'product_handle': product_handle,
                'product_description': product_description,
                'vendor': vendor,
                'product_type': product_type,
                'tags': tags,
                'status': status,
                'created_at': created_at,
                'updated_at': updated_at,
                'published_at': published_at,
                'total_inventory': total_inventory,
                'total_variants': total_variants,
                'first_image_url': first_image_url,
                
                # Variant Information (unique per row)
                'variant_id': variant_id,
                'variant_title': variant_title,
                'variant_price': variant_price,
                'variant_sku': variant_sku,
                'variant_inventory_quantity': variant_inventory_quantity
            })
    
    return product_variants

def export_to_csv(product_variants, filename=None):
    """
    Export product variants data to CSV file
    """
    if not product_variants:
        print("No product variants data to export")
        return
    
    if filename is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"maeri_product_variants_{timestamp}.csv"
    
    fieldnames = [
        # Product Information
        'product_id', 'product_title', 'product_handle', 'product_description',
        'vendor', 'product_type', 'tags', 'status',
        'created_at', 'updated_at', 'published_at',
        'total_inventory', 'total_variants', 'first_image_url',
        
        # Variant Information
        'variant_id', 'variant_title', 'variant_price',
        'variant_sku', 'variant_inventory_quantity'
    ]
    
    try:
        with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(product_variants)
        
        print(f"✅ Successfully exported {len(product_variants)} product variants to {filename}")
        return filename
    except Exception as e:
        print(f"❌ Error exporting to CSV: {e}")
        return None

def main():
    """
    Main function to fetch and export product variants data
    """
    print("🚀 Fetching Maeri product variants data...")
    
    # Fetch data
    products_data = fetch_products_with_variants()
    if not products_data:
        print("❌ Failed to fetch products data")
        sys.exit(1)
    
    # Check for errors
    if 'errors' in products_data:
        print("❌ GraphQL errors:")
        for error in products_data['errors']:
            print(f"  - {error['message']}")
        if 'data' not in products_data:
            sys.exit(1)
    
    # Parse data
    product_variants = parse_product_variants_data(products_data)
    print(f"📊 Found {len(product_variants)} product variants")
    
    # Export to CSV
    filename = export_to_csv(product_variants)
    if filename:
        print(f"📄 Data exported to: {filename}")
        
        # Print summary
        if product_variants:
            unique_products = len(set(item['product_id'] for item in product_variants))
            total_inventory = sum(item['variant_inventory_quantity'] for item in product_variants)
            avg_price = sum(item['variant_price'] for item in product_variants) / len(product_variants)
            active_products = len([item for item in product_variants if item['status'] == 'ACTIVE'])
            draft_products = len([item for item in product_variants if item['status'] == 'DRAFT'])
            
            print(f"\n📈 Summary:")
            print(f"  Total Product Variants: {len(product_variants)}")
            print(f"  Unique Products: {unique_products}")
            print(f"  Total Inventory: {total_inventory} units")
            print(f"  Average Price: ₹{avg_price:.2f} INR")
            print(f"  Active Products: {active_products}")
            print(f"  Draft Products: {draft_products}")
            
            # Top products by inventory
            from collections import Counter
            product_inventory = Counter()
            for item in product_variants:
                product_inventory[item['product_title']] += item['variant_inventory_quantity']
            
            print(f"\n🏆 Top Products by Inventory:")
            for product, inventory in product_inventory.most_common(5):
                print(f"  {product}: {inventory} units")
                
            # Products with low inventory (less than 5 units)
            low_inventory = [item for item in product_variants if item['variant_inventory_quantity'] < 5]
            if low_inventory:
                print(f"\n⚠️  Low Inventory Alerts ({len(low_inventory)} variants):")
                for item in low_inventory[:5]:  # Show first 5
                    print(f"  {item['product_title']} ({item['variant_title']}): {item['variant_inventory_quantity']} units")
                if len(low_inventory) > 5:
                    print(f"  ... and {len(low_inventory) - 5} more")
    else:
        print("❌ Failed to export data")
        sys.exit(1)

if __name__ == "__main__":
    main() 