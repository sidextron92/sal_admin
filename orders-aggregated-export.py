#!/usr/bin/env python3
"""
Maeri Shopify Orders Aggregated Data Export
Fetches order-level data with marketing conversion tracking and exports to CSV
Perfect for financial reports, ROAS analysis, and conversion tracking
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

def fetch_orders_aggregated(limit=250):
    """
    Fetch order aggregated data from Shopify GraphQL API
    """
    url = f"https://{SHOPIFY_DOMAIN}/admin/api/{API_VERSION}/graphql.json"
    
    query = """
    query GetOrdersAggregated($first: Int!) {
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
                  quantity
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

def parse_order_data(orders_data):
    """
    Parse order data into flat structure for CSV export
    """
    if not orders_data or 'data' not in orders_data:
        return []
    
    orders = []
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
        
        # Line items count
        line_items_count = len(order['lineItems']['edges'])
        
        orders.append({
            'order_id': order_id,
            'order_name': order_name,
            'created_at': created_at,
            'updated_at': updated_at,
            'customer_id': customer_id,
            'total_price': total_price,
            'subtotal_price': subtotal_price,
            'total_tax': total_tax,
            'currency': currency,
            'financial_status': financial_status,
            'fulfillment_status': fulfillment_status,
            'confirmed': confirmed,
            'cancelled_at': cancelled_at,
            'cancel_reason': cancel_reason,
            'tags': tags,
            'note': note,
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
            'line_items_count': line_items_count
        })
    
    return orders

def export_to_csv(orders, filename=None):
    """
    Export orders data to CSV file
    """
    if not orders:
        print("No orders data to export")
        return
    
    if filename is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"maeri_orders_aggregated_{timestamp}.csv"
    
    fieldnames = [
        'order_id', 'order_name', 'created_at', 'updated_at', 'customer_id',
        'total_price', 'subtotal_price', 'total_tax', 'currency',
        'financial_status', 'fulfillment_status', 'confirmed',
        'cancelled_at', 'cancel_reason', 'tags', 'note',
        'customer_order_index', 'days_to_conversion',
        'first_landing_page', 'first_referrer', 'first_source',
        'first_marketing_channel', 'first_marketing_type',
        'first_utm_campaign', 'first_utm_content', 'first_utm_medium',
        'first_utm_source', 'first_utm_term',
        'last_landing_page', 'last_referrer', 'last_source',
        'last_marketing_channel', 'last_marketing_type',
        'last_utm_campaign', 'last_utm_content', 'last_utm_medium',
        'last_utm_source', 'last_utm_term',
        'line_items_count'
    ]
    
    try:
        with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(orders)
        
        print(f"✅ Successfully exported {len(orders)} orders to {filename}")
        return filename
    except Exception as e:
        print(f"❌ Error exporting to CSV: {e}")
        return None

def main():
    """
    Main function to fetch and export order data
    """
    print("🚀 Fetching Maeri orders aggregated data...")
    
    # Fetch data
    orders_data = fetch_orders_aggregated()
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
    orders = parse_order_data(orders_data)
    print(f"📊 Found {len(orders)} orders")
    
    # Export to CSV
    filename = export_to_csv(orders)
    if filename:
        print(f"📄 Data exported to: {filename}")
        
        # Print summary
        if orders:
            total_revenue = sum(order['total_price'] for order in orders)
            avg_order_value = total_revenue / len(orders)
            print(f"\n📈 Summary:")
            print(f"  Total Orders: {len(orders)}")
            print(f"  Total Revenue: {total_revenue:.2f} {orders[0]['currency']}")
            print(f"  Average Order Value: {avg_order_value:.2f} {orders[0]['currency']}")
            print(f"  New Customers: {len([o for o in orders if o['customer_order_index'] == 0])}")
            print(f"  Returning Customers: {len([o for o in orders if o['customer_order_index'] and o['customer_order_index'] > 0])}")
    else:
        print("❌ Failed to export data")
        sys.exit(1)

if __name__ == "__main__":
    main() 