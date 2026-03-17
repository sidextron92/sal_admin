#!/usr/bin/env python3
"""
Maeri Shopify Orders Items Data Export
Fetches detailed order + line item data with marketing conversion tracking
Perfect for product analysis, inventory management, and detailed reporting
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

def fetch_orders_with_items(limit=250):
    """
    Fetch order with detailed line items data from Shopify GraphQL API
    """
    url = f"https://{SHOPIFY_DOMAIN}/admin/api/{API_VERSION}/graphql.json"
    
    query = """
    query GetOrdersWithItems($first: Int!) {
      orders(first: $first) {
        edges {
          node {
            id
            name
            createdAt
            updatedAt
            customer {
              id
            }
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            subtotalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            totalTaxSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            displayFinancialStatus
            displayFulfillmentStatus
            confirmed
            cancelledAt
            cancelReason
            tags
            note
            customerJourneySummary {
              customerOrderIndex
              daysToConversion
                             firstVisit {
                 landingPage
                 referrerUrl
                 source
                 marketingEvent {
                   channel
                   type
                 }
                 utmParameters {
                   campaign
                   content
                   medium
                   source
                   term
                 }
               }
               lastVisit {
                 landingPage
                 referrerUrl
                 source
                 marketingEvent {
                   channel
                   type
                 }
                 utmParameters {
                   campaign
                   content
                   medium
                   source
                   term
                 }
               }
            }
            lineItems(first: 50) {
              edges {
                node {
                  id
                  title
                  quantity
                  originalUnitPriceSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                  discountedUnitPriceSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                  totalDiscountSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                  product {
                    id
                    title
                    handle
                    vendor
                    productType
                  }
                  variant {
                    id
                    title
                    sku
                  }
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

def parse_order_items_data(orders_data):
    """
    Parse order + line items data into flat structure for CSV export
    Each row represents one line item with full order information
    """
    if not orders_data or 'data' not in orders_data:
        return []
    
    order_items = []
    for edge in orders_data['data']['orders']['edges']:
        order = edge['node']
        
        # Basic order information
        order_id = order['id'].split('/')[-1]
        order_name = order['name']
        created_at = order['createdAt']
        updated_at = order['updatedAt']
        customer_id = order['customer']['id'].split('/')[-1] if order['customer'] else None
        
        # Financial information
        total_price = float(order['totalPriceSet']['shopMoney']['amount'])
        subtotal_price = float(order['subtotalPriceSet']['shopMoney']['amount'])
        total_tax = float(order['totalTaxSet']['shopMoney']['amount'])
        currency = order['totalPriceSet']['shopMoney']['currencyCode']
        
        # Status information
        financial_status = order['displayFinancialStatus']
        fulfillment_status = order['displayFulfillmentStatus']
        confirmed = order['confirmed']
        cancelled_at = order['cancelledAt']
        cancel_reason = order['cancelReason']
        
        # Metadata
        tags = ', '.join(order['tags']) if order['tags'] else ''
        note = order['note'] or ''
        
        # Marketing conversion data
        journey = order['customerJourneySummary']
        customer_order_index = journey['customerOrderIndex'] if journey else None
        days_to_conversion = journey['daysToConversion'] if journey else None
        
        # First visit data
        first_visit = journey.get('firstVisit') if journey else None
        first_landing_page = first_visit.get('landingPage', '') if first_visit else ''
        first_referrer = first_visit.get('referrerUrl', '') if first_visit else ''
        first_source = first_visit.get('source', '') if first_visit else ''
        first_marketing_event = first_visit.get('marketingEvent') if first_visit else None
        first_marketing_channel = first_marketing_event.get('channel', '') if first_marketing_event else ''
        first_marketing_type = first_marketing_event.get('type', '') if first_marketing_event else ''
        first_utm = first_visit.get('utmParameters') if first_visit else None
        first_utm_campaign = first_utm.get('campaign', '') if first_utm else ''
        first_utm_content = first_utm.get('content', '') if first_utm else ''
        first_utm_medium = first_utm.get('medium', '') if first_utm else ''
        first_utm_source = first_utm.get('source', '') if first_utm else ''
        first_utm_term = first_utm.get('term', '') if first_utm else ''
        
        # Last visit data
        last_visit = journey.get('lastVisit') if journey else None
        last_landing_page = last_visit.get('landingPage', '') if last_visit else ''
        last_referrer = last_visit.get('referrerUrl', '') if last_visit else ''
        last_source = last_visit.get('source', '') if last_visit else ''
        last_marketing_event = last_visit.get('marketingEvent') if last_visit else None
        last_marketing_channel = last_marketing_event.get('channel', '') if last_marketing_event else ''
        last_marketing_type = last_marketing_event.get('type', '') if last_marketing_event else ''
        last_utm = last_visit.get('utmParameters') if last_visit else None
        last_utm_campaign = last_utm.get('campaign', '') if last_utm else ''
        last_utm_content = last_utm.get('content', '') if last_utm else ''
        last_utm_medium = last_utm.get('medium', '') if last_utm else ''
        last_utm_source = last_utm.get('source', '') if last_utm else ''
        last_utm_term = last_utm.get('term', '') if last_utm else ''
        
        # Process each line item
        for item_edge in order['lineItems']['edges']:
            item = item_edge['node']
            
            # Line item information
            line_item_id = item['id'].split('/')[-1]
            item_title = item['title']
            quantity = item['quantity']
            
            # Pricing information
            original_price = float(item['originalUnitPriceSet']['shopMoney']['amount'])
            discounted_price = float(item['discountedUnitPriceSet']['shopMoney']['amount'])
            total_discount = float(item['totalDiscountSet']['shopMoney']['amount'])
            item_currency = item['originalUnitPriceSet']['shopMoney']['currencyCode']
            
            # Product information
            product = item['product']
            product_id = product['id'].split('/')[-1] if product else None
            product_title = product['title'] if product else ''
            product_handle = product['handle'] if product else ''
            vendor = product['vendor'] if product else ''
            product_type = product['productType'] if product else ''
            
            # Variant information
            variant = item['variant']
            variant_id = variant['id'].split('/')[-1] if variant else None
            variant_title = variant['title'] if variant else ''
            sku = variant['sku'] if variant else ''
            
            # Calculate line totals
            line_total = original_price * quantity
            line_total_discounted = discounted_price * quantity
            
            order_items.append({
                # Order Information
                'order_id': order_id,
                'order_name': order_name,
                'created_at': created_at,
                'updated_at': updated_at,
                'customer_id': customer_id,
                'order_total_price': total_price,
                'order_subtotal_price': subtotal_price,
                'order_total_tax': total_tax,
                'order_currency': currency,
                'financial_status': financial_status,
                'fulfillment_status': fulfillment_status,
                'confirmed': confirmed,
                'cancelled_at': cancelled_at,
                'cancel_reason': cancel_reason,
                'order_tags': tags,
                'order_note': note,
                
                # Marketing Conversion Data
                'customer_order_index': customer_order_index,
                'days_to_conversion': days_to_conversion,
                                 'first_landing_page': first_landing_page,
                 'first_referrer': first_referrer,
                 'first_source': first_source,
                 'first_marketing_channel': first_marketing_channel,
                 'first_marketing_type': first_marketing_type,
                 'first_utm_campaign': first_utm_campaign,
                 'first_utm_content': first_utm_content,
                 'first_utm_medium': first_utm_medium,
                 'first_utm_source': first_utm_source,
                 'first_utm_term': first_utm_term,
                 'last_landing_page': last_landing_page,
                 'last_referrer': last_referrer,
                 'last_source': last_source,
                 'last_marketing_channel': last_marketing_channel,
                 'last_marketing_type': last_marketing_type,
                 'last_utm_campaign': last_utm_campaign,
                 'last_utm_content': last_utm_content,
                 'last_utm_medium': last_utm_medium,
                 'last_utm_source': last_utm_source,
                 'last_utm_term': last_utm_term,
                
                # Line Item Information
                'line_item_id': line_item_id,
                'item_title': item_title,
                'quantity': quantity,
                'original_unit_price': original_price,
                'discounted_unit_price': discounted_price,
                'total_discount': total_discount,
                'item_currency': item_currency,
                'line_total': line_total,
                'line_total_discounted': line_total_discounted,
                
                # Product Information
                'product_id': product_id,
                'product_title': product_title,
                'product_handle': product_handle,
                'vendor': vendor,
                'product_type': product_type,
                
                # Variant Information
                'variant_id': variant_id,
                'variant_title': variant_title,
                'sku': sku
            })
    
    return order_items

def export_to_csv(order_items, filename=None):
    """
    Export order items data to CSV file
    """
    if not order_items:
        print("No order items data to export")
        return
    
    if filename is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"maeri_order_items_{timestamp}.csv"
    
    fieldnames = [
        # Order Information
        'order_id', 'order_name', 'created_at', 'updated_at', 'customer_id',
        'order_total_price', 'order_subtotal_price', 'order_total_tax', 'order_currency',
        'financial_status', 'fulfillment_status', 'confirmed',
        'cancelled_at', 'cancel_reason', 'order_tags', 'order_note',
        
        # Marketing Conversion Data
        'customer_order_index', 'days_to_conversion',
        'first_landing_page', 'first_referrer', 'first_source',
        'first_marketing_channel', 'first_marketing_type',
        'first_utm_campaign', 'first_utm_content', 'first_utm_medium',
        'first_utm_source', 'first_utm_term',
        'last_landing_page', 'last_referrer', 'last_source',
        'last_marketing_channel', 'last_marketing_type',
        'last_utm_campaign', 'last_utm_content', 'last_utm_medium',
        'last_utm_source', 'last_utm_term',
        
        # Line Item Information
        'line_item_id', 'item_title', 'quantity',
        'original_unit_price', 'discounted_unit_price', 'total_discount',
        'item_currency', 'line_total', 'line_total_discounted',
        
        # Product Information
        'product_id', 'product_title', 'product_handle',
        'vendor', 'product_type',
        
        # Variant Information
        'variant_id', 'variant_title', 'sku'
    ]
    
    try:
        with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(order_items)
        
        print(f"✅ Successfully exported {len(order_items)} order items to {filename}")
        return filename
    except Exception as e:
        print(f"❌ Error exporting to CSV: {e}")
        return None

def main():
    """
    Main function to fetch and export order items data
    """
    print("🚀 Fetching Maeri order items data...")
    
    # Fetch data
    orders_data = fetch_orders_with_items()
    if not orders_data:
        print("❌ Failed to fetch orders data")
        sys.exit(1)
    
    # Check for errors
    if 'errors' in orders_data:
        print("❌ GraphQL errors:")
        for error in orders_data['errors']:
            print(f"  - {error['message']}")
        if 'data' not in orders_data:
            sys.exit(1)
    
    # Parse data
    order_items = parse_order_items_data(orders_data)
    print(f"📊 Found {len(order_items)} order line items")
    
    # Export to CSV
    filename = export_to_csv(order_items)
    if filename:
        print(f"📄 Data exported to: {filename}")
        
        # Print summary
        if order_items:
            unique_orders = len(set(item['order_id'] for item in order_items))
            unique_products = len(set(item['product_id'] for item in order_items if item['product_id']))
            total_quantity = sum(item['quantity'] for item in order_items)
            total_revenue = sum(item['line_total_discounted'] for item in order_items)
            
            print(f"\n📈 Summary:")
            print(f"  Total Line Items: {len(order_items)}")
            print(f"  Unique Orders: {unique_orders}")
            print(f"  Unique Products: {unique_products}")
            print(f"  Total Quantity Sold: {total_quantity}")
            print(f"  Total Revenue: {total_revenue:.2f} {order_items[0]['order_currency']}")
            
            # Top products by quantity
            from collections import Counter
            product_sales = Counter()
            for item in order_items:
                if item['product_title']:
                    product_sales[item['product_title']] += item['quantity']
            
            print(f"\n🏆 Top Products by Quantity:")
            for product, qty in product_sales.most_common(5):
                print(f"  {product}: {qty} units")
    else:
        print("❌ Failed to export data")
        sys.exit(1)

if __name__ == "__main__":
    main() 