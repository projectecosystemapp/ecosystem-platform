/**
 * Email Service Test Suite
 * Tests all 14 email templates, parameter handling, HTML generation,
 * and email queue integration
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { 
  emailService, 
  sendEmail,
  sendBookingConfirmation,
  sendProviderBookingNotification,
  sendPaymentReceipt,
  sendPayoutNotification,
  sendBookingCancellation,
  sendWelcomeEmail,
  sendHoldExpirationWarning,
  sendAppointmentReminder,
  sendRefundConfirmation,
  sendGuestMagicLink,
  sendProviderAcceptanceNotification,
  sendNoShowNotification,
  sendDisputeNotification,
  type BookingConfirmationData,
  type ProviderNotificationData,
  type PaymentReceiptData,
  type PayoutNotificationData,
} from '@/lib/services/email-service';
import { Resend } from 'resend';

// Mock Resend
jest.mock('resend');
const MockResend = Resend as jest.MockedClass<typeof Resend>;

describe('EmailService', () => {
  let mockResend: jest.Mocked<Resend>;

  beforeEach(() => {
    // Reset environment variables
    process.env.RESEND_API_KEY = 'test-resend-key';
    process.env.RESEND_FROM_EMAIL = 'test@ecosystem.com';
    process.env.RESEND_REPLY_TO = 'support@ecosystem.com';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

    // Create mocked Resend instance
    mockResend = {
      emails: {
        send: jest.fn(),
      },
    } as any;

    MockResend.mockImplementation(() => mockResend);

    // Default successful response
    mockResend.emails.send.mockResolvedValue({
      data: { id: 'email-123' },
      error: null,
    });

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Generic Email Sending', () => {
    it('should send basic email successfully', async () => {
      const emailOptions = {
        to: 'customer@example.com',
        subject: 'Test Email',
        html: '<h1>Hello World</h1>',
        text: 'Hello World',
      };

      const result = await sendEmail(emailOptions);

      expect(result.success).toBe(true);
      expect(result.id).toBe('email-123');
      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'test@ecosystem.com',
          to: 'customer@example.com',
          subject: 'Test Email',
          html: '<h1>Hello World</h1>',
          text: 'Hello World',
          replyTo: 'support@ecosystem.com',
        })
      );
    });

    it('should handle multiple recipients', async () => {
      const emailOptions = {
        to: ['customer1@example.com', 'customer2@example.com'],
        subject: 'Bulk Email',
        html: '<p>Bulk message</p>',
      };

      await sendEmail(emailOptions);

      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['customer1@example.com', 'customer2@example.com'],
        })
      );
    });

    it('should include attachments when provided', async () => {
      const attachment = {
        filename: 'receipt.pdf',
        content: Buffer.from('PDF content'),
      };

      const emailOptions = {
        to: 'customer@example.com',
        subject: 'Email with Attachment',
        html: '<p>See attachment</p>',
        attachments: [attachment],
      };

      await sendEmail(emailOptions);

      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: [attachment],
        })
      );
    });

    it('should handle email send failures', async () => {
      mockResend.emails.send.mockResolvedValue({
        data: null,
        error: { message: 'Invalid API key' },
      } as any);

      const emailOptions = {
        to: 'customer@example.com',
        subject: 'Test Email',
        html: '<p>Test</p>',
      };

      await expect(sendEmail(emailOptions)).rejects.toThrow('Email send failed: Invalid API key');
    });

    it('should handle network errors', async () => {
      mockResend.emails.send.mockRejectedValue(new Error('Network timeout'));

      const emailOptions = {
        to: 'customer@example.com',
        subject: 'Test Email',
        html: '<p>Test</p>',
      };

      await expect(sendEmail(emailOptions)).rejects.toThrow('Network timeout');
    });
  });

  describe('Booking Confirmation Email', () => {
    const mockBookingData: BookingConfirmationData = {
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
      providerName: 'Yoga Studio Downtown',
      serviceName: 'Beginner Yoga Class',
      bookingDate: new Date('2024-02-15T10:00:00Z'),
      startTime: '10:00',
      endTime: '11:00',
      totalAmount: 35,
      bookingId: 'booking-123',
      providerEmail: 'studio@yoga.com',
      location: '123 Main St, NYC',
    };

    it('should send booking confirmation with all details', async () => {
      await sendBookingConfirmation(mockBookingData);

      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'john@example.com',
          subject: expect.stringContaining('Booking Confirmed'),
          html: expect.stringContaining('Booking Confirmed!'),
          replyTo: 'studio@yoga.com',
        })
      );

      const sentEmail = mockResend.emails.send.mock.calls[0][0];
      expect(sentEmail.html).toContain('John Doe');
      expect(sentEmail.html).toContain('Yoga Studio Downtown');
      expect(sentEmail.html).toContain('Beginner Yoga Class');
      expect(sentEmail.html).toContain('Thursday, February 15, 2024');
      expect(sentEmail.html).toContain('10:00 - 11:00');
      expect(sentEmail.html).toContain('$35.00');
      expect(sentEmail.html).toContain('booking-123');
      expect(sentEmail.html).toContain('123 Main St, NYC');
    });

    it('should handle missing location gracefully', async () => {
      const dataWithoutLocation = { ...mockBookingData, location: undefined };

      await sendBookingConfirmation(dataWithoutLocation);

      const sentEmail = mockResend.emails.send.mock.calls[0][0];
      expect(sentEmail.html).not.toContain('Location:');
    });

    it('should include view booking link', async () => {
      await sendBookingConfirmation(mockBookingData);

      const sentEmail = mockResend.emails.send.mock.calls[0][0];
      expect(sentEmail.html).toContain('http://localhost:3000/bookings/booking-123');
    });
  });

  describe('Provider Booking Notification', () => {
    const mockProviderData: ProviderNotificationData = {
      providerName: 'Sarah Smith',
      providerEmail: 'sarah@yogastudio.com',
      customerName: 'John Doe',
      serviceName: 'Private Yoga Session',
      bookingDate: new Date('2024-02-20T14:00:00Z'),
      startTime: '14:00',
      endTime: '15:00',
      bookingId: 'booking-456',
      customerEmail: 'john@example.com',
      customerNotes: 'First time doing yoga, please be patient',
    };

    it('should send provider notification with booking details', async () => {
      await sendProviderBookingNotification(mockProviderData);

      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'sarah@yogastudio.com',
          subject: expect.stringContaining('New Booking'),
          html: expect.stringContaining('New Booking!'),
          replyTo: 'john@example.com',
        })
      );

      const sentEmail = mockResend.emails.send.mock.calls[0][0];
      expect(sentEmail.html).toContain('Sarah Smith');
      expect(sentEmail.html).toContain('John Doe');
      expect(sentEmail.html).toContain('Private Yoga Session');
      expect(sentEmail.html).toContain('Tuesday, February 20, 2024');
      expect(sentEmail.html).toContain('First time doing yoga');
    });

    it('should handle missing customer notes', async () => {
      const dataWithoutNotes = { ...mockProviderData, customerNotes: undefined };

      await sendProviderBookingNotification(dataWithoutNotes);

      const sentEmail = mockResend.emails.send.mock.calls[0][0];
      expect(sentEmail.html).not.toContain('Customer Notes:');
    });
  });

  describe('Payment Receipt Email', () => {
    const mockReceiptData: PaymentReceiptData = {
      customerName: 'Jane Smith',
      customerEmail: 'jane@example.com',
      amount: 45,
      serviceName: 'Massage Therapy',
      providerName: 'Wellness Center',
      paymentDate: new Date('2024-02-10T16:30:00Z'),
      paymentIntentId: 'pi_1234567890',
      bookingId: 'booking-789',
    };

    it('should send payment receipt with transaction details', async () => {
      await sendPaymentReceipt(mockReceiptData);

      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'jane@example.com',
          subject: expect.stringContaining('Payment Receipt'),
        })
      );

      const sentEmail = mockResend.emails.send.mock.calls[0][0];
      expect(sentEmail.html).toContain('Jane Smith');
      expect(sentEmail.html).toContain('$45.00');
      expect(sentEmail.html).toContain('Massage Therapy');
      expect(sentEmail.html).toContain('Wellness Center');
      expect(sentEmail.html).toContain('pi_1234567890');
      expect(sentEmail.html).toContain('booking-789');
    });

    it('should format payment date correctly', async () => {
      await sendPaymentReceipt(mockReceiptData);

      const sentEmail = mockResend.emails.send.mock.calls[0][0];
      expect(sentEmail.html).toContain('February 10, 2024');
    });
  });

  describe('Payout Notification Email', () => {
    const mockPayoutData: PayoutNotificationData = {
      providerName: 'Wellness Center',
      providerEmail: 'billing@wellness.com',
      amount: 450,
      processingDate: new Date('2024-02-25T09:00:00Z'),
      bookings: [
        { id: 'booking-1', serviceName: 'Massage', amount: 200 },
        { id: 'booking-2', serviceName: 'Facial', amount: 150 },
        { id: 'booking-3', serviceName: 'Yoga Class', amount: 100 },
      ],
      payoutId: 'payout-abc123',
    };

    it('should send payout notification with booking breakdown', async () => {
      await sendPayoutNotification(mockPayoutData);

      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'billing@wellness.com',
          subject: expect.stringContaining('Payout Processed: $450.00'),
        })
      );

      const sentEmail = mockResend.emails.send.mock.calls[0][0];
      expect(sentEmail.html).toContain('Wellness Center');
      expect(sentEmail.html).toContain('$450.00');
      expect(sentEmail.html).toContain('payout-abc123');
      
      // Check booking list
      expect(sentEmail.html).toContain('Massage - $200.00');
      expect(sentEmail.html).toContain('Facial - $150.00');
      expect(sentEmail.html).toContain('Yoga Class - $100.00');
    });
  });

  describe('Booking Cancellation Email', () => {
    it('should send cancellation email without refund', async () => {
      await sendBookingCancellation(
        'customer@example.com',
        'John Doe',
        'Yoga Studio',
        'Morning Yoga',
        new Date('2024-03-01'),
        undefined // No refund
      );

      const sentEmail = mockResend.emails.send.mock.calls[0][0];
      expect(sentEmail.html).toContain('Booking Cancelled');
      expect(sentEmail.html).toContain('John Doe');
      expect(sentEmail.html).toContain('Morning Yoga');
      expect(sentEmail.html).not.toContain('Refund Amount:');
    });

    it('should send cancellation email with refund info', async () => {
      await sendBookingCancellation(
        'customer@example.com',
        'John Doe',
        'Yoga Studio',
        'Morning Yoga',
        new Date('2024-03-01'),
        25.50 // Refund amount
      );

      const sentEmail = mockResend.emails.send.mock.calls[0][0];
      expect(sentEmail.html).toContain('$25.50');
      expect(sentEmail.html).toContain('refund');
    });
  });

  describe('Welcome Email', () => {
    it('should send customer welcome email', async () => {
      await sendWelcomeEmail('newuser@example.com', 'New User', false);

      const sentEmail = mockResend.emails.send.mock.calls[0][0];
      expect(sentEmail.to).toBe('newuser@example.com');
      expect(sentEmail.html).toContain('Welcome to Ecosystem Marketplace!');
      expect(sentEmail.html).toContain('New User');
      expect(sentEmail.html).toContain('Browse available services');
      expect(sentEmail.html).not.toContain('Complete your provider profile');
    });

    it('should send provider welcome email', async () => {
      await sendWelcomeEmail('provider@example.com', 'New Provider', true);

      const sentEmail = mockResend.emails.send.mock.calls[0][0];
      expect(sentEmail.html).toContain('Complete your provider profile');
      expect(sentEmail.html).toContain('List your services');
      expect(sentEmail.html).toContain('Start accepting bookings');
      expect(sentEmail.html).not.toContain('Browse available services');
    });
  });

  describe('Hold Expiration Warning Email', () => {
    it('should send hold expiration warning', async () => {
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

      await sendHoldExpirationWarning(
        'customer@example.com',
        'John Doe',
        'Yoga Class',
        'Downtown Studio',
        expiresAt
      );

      const sentEmail = mockResend.emails.send.mock.calls[0][0];
      expect(sentEmail.html).toContain('Your Booking Hold is Expiring Soon!');
      expect(sentEmail.html).toContain('5 minutes remaining');
      expect(sentEmail.html).toContain('Yoga Class');
      expect(sentEmail.html).toContain('Downtown Studio');
      expect(sentEmail.html).toContain('Complete Booking Now');
    });
  });

  describe('Appointment Reminder Email', () => {
    it('should send 24-hour reminder', async () => {
      await sendAppointmentReminder(
        'customer@example.com',
        'John Doe',
        'Yoga Studio',
        'Morning Yoga',
        new Date('2024-03-15'),
        '10:00',
        '11:00',
        '123 Main St',
        24
      );

      const sentEmail = mockResend.emails.send.mock.calls[0][0];
      expect(sentEmail.html).toContain('Appointment Reminder');
      expect(sentEmail.html).toContain('Tomorrow: Morning Yoga');
      expect(sentEmail.html).toContain('123 Main St');
    });

    it('should send 2-hour reminder', async () => {
      await sendAppointmentReminder(
        'customer@example.com',
        'John Doe',
        'Yoga Studio',
        'Morning Yoga',
        new Date('2024-03-15'),
        '10:00',
        '11:00',
        undefined, // No location
        2
      );

      const sentEmail = mockResend.emails.send.mock.calls[0][0];
      expect(sentEmail.html).toContain('In 2 hours: Morning Yoga');
      expect(sentEmail.html).not.toContain('Location:');
    });
  });

  describe('Refund Confirmation Email', () => {
    it('should send full refund confirmation', async () => {
      await sendRefundConfirmation(
        'customer@example.com',
        'John Doe',
        100,
        'full',
        'Yoga Class',
        'Downtown Studio',
        'Provider cancelled',
        'refund-123'
      );

      const sentEmail = mockResend.emails.send.mock.calls[0][0];
      expect(sentEmail.html).toContain('Full Refund');
      expect(sentEmail.html).toContain('$100.00');
      expect(sentEmail.html).toContain('Provider cancelled');
      expect(sentEmail.html).toContain('refund-123');
    });

    it('should send partial refund confirmation', async () => {
      await sendRefundConfirmation(
        'customer@example.com',
        'John Doe',
        50,
        'partial',
        'Yoga Class',
        'Downtown Studio',
        'Late cancellation',
        'refund-456'
      );

      const sentEmail = mockResend.emails.send.mock.calls[0][0];
      expect(sentEmail.html).toContain('Partial Refund');
      expect(sentEmail.html).toContain('$50.00');
    });
  });

  describe('Guest Magic Link Email', () => {
    it('should send magic link without booking details', async () => {
      await sendGuestMagicLink(
        'guest@example.com',
        'https://app.com/auth/magic?token=abc123'
      );

      const sentEmail = mockResend.emails.send.mock.calls[0][0];
      expect(sentEmail.to).toBe('guest@example.com');
      expect(sentEmail.html).toContain('Access Your Account');
      expect(sentEmail.html).toContain('https://app.com/auth/magic?token=abc123');
      expect(sentEmail.html).not.toContain('Your Recent Booking:');
    });

    it('should send magic link with booking details', async () => {
      const bookingDetails = {
        serviceName: 'Massage Therapy',
        providerName: 'Wellness Spa',
        bookingDate: new Date('2024-03-20'),
      };

      await sendGuestMagicLink(
        'guest@example.com',
        'https://app.com/auth/magic?token=abc123',
        bookingDetails
      );

      const sentEmail = mockResend.emails.send.mock.calls[0][0];
      expect(sentEmail.html).toContain('Your Recent Booking:');
      expect(sentEmail.html).toContain('Massage Therapy');
      expect(sentEmail.html).toContain('Wellness Spa');
      expect(sentEmail.html).toContain('March 20, 2024');
    });
  });

  describe('Provider Acceptance Notification', () => {
    it('should send provider acceptance notification', async () => {
      await sendProviderAcceptanceNotification(
        'customer@example.com',
        'John Doe',
        'Yoga Studio',
        'Beginner Yoga',
        new Date('2024-04-01'),
        '10:00',
        'booking-789'
      );

      const sentEmail = mockResend.emails.send.mock.calls[0][0];
      expect(sentEmail.html).toContain('Booking Accepted!');
      expect(sentEmail.html).toContain('Yoga Studio');
      expect(sentEmail.html).toContain('has accepted your booking');
      expect(sentEmail.html).toContain('booking-789');
    });
  });

  describe('No-Show Notification Email', () => {
    it('should send customer no-show notification', async () => {
      await sendNoShowNotification(
        'provider@example.com',
        'Provider Name',
        true, // isProvider
        'Yoga Class',
        new Date('2024-04-05'),
        'John Customer'
      );

      const sentEmail = mockResend.emails.send.mock.calls[0][0];
      expect(sentEmail.html).toContain('No-Show Recorded');
      expect(sentEmail.html).toContain('customer did not arrive');
      expect(sentEmail.html).toContain('you will receive compensation');
    });

    it('should send provider no-show notification', async () => {
      await sendNoShowNotification(
        'customer@example.com',
        'Customer Name',
        false, // isProvider
        'Yoga Class',
        new Date('2024-04-05'),
        'Provider Name'
      );

      const sentEmail = mockResend.emails.send.mock.calls[0][0];
      expect(sentEmail.html).toContain('provider did not provide');
      expect(sentEmail.html).toContain('charges may apply');
    });
  });

  describe('Dispute Notification Email', () => {
    it('should send dispute notification', async () => {
      await sendDisputeNotification(
        'provider@example.com',
        'Provider Name',
        'Customer Smith',
        'Massage Therapy',
        new Date('2024-04-10'),
        'Service was not as described',
        'dispute-123'
      );

      const sentEmail = mockResend.emails.send.mock.calls[0][0];
      expect(sentEmail.html).toContain('Dispute Initiated');
      expect(sentEmail.html).toContain('Customer Smith');
      expect(sentEmail.html).toContain('Service was not as described');
      expect(sentEmail.html).toContain('dispute-123');
      expect(sentEmail.html).toContain('24-48 hours');
    });
  });

  describe('Email Service Instance', () => {
    it('should export emailService with all methods', () => {
      expect(emailService.send).toBeDefined();
      expect(emailService.sendBookingConfirmation).toBeDefined();
      expect(emailService.sendProviderBookingNotification).toBeDefined();
      expect(emailService.sendPaymentReceipt).toBeDefined();
      expect(emailService.sendPayoutNotification).toBeDefined();
      expect(emailService.sendBookingCancellation).toBeDefined();
      expect(emailService.sendWelcomeEmail).toBeDefined();
      expect(emailService.sendHoldExpirationWarning).toBeDefined();
      expect(emailService.sendAppointmentReminder).toBeDefined();
      expect(emailService.sendRefundConfirmation).toBeDefined();
      expect(emailService.sendGuestMagicLink).toBeDefined();
      expect(emailService.sendProviderAcceptanceNotification).toBeDefined();
      expect(emailService.sendNoShowNotification).toBeDefined();
      expect(emailService.sendDisputeNotification).toBeDefined();
    });
  });

  describe('HTML Template Validation', () => {
    it('should generate valid HTML structure', async () => {
      await sendBookingConfirmation({
        customerName: 'Test User',
        customerEmail: 'test@example.com',
        providerName: 'Test Provider',
        serviceName: 'Test Service',
        bookingDate: new Date(),
        startTime: '10:00',
        endTime: '11:00',
        totalAmount: 50,
        bookingId: 'test-booking',
      });

      const sentEmail = mockResend.emails.send.mock.calls[0][0];
      
      // Basic HTML structure validation
      expect(sentEmail.html).toContain('<!DOCTYPE html>');
      expect(sentEmail.html).toContain('<html>');
      expect(sentEmail.html).toContain('<head>');
      expect(sentEmail.html).toContain('<body>');
      expect(sentEmail.html).toContain('</html>');
      
      // CSS styles should be present
      expect(sentEmail.html).toContain('<style>');
      expect(sentEmail.html).toContain('font-family');
      expect(sentEmail.html).toContain('background');
      expect(sentEmail.html).toContain('color');
    });

    it('should escape HTML in dynamic content', async () => {
      await sendBookingConfirmation({
        customerName: '<script>alert("xss")</script>',
        customerEmail: 'test@example.com',
        providerName: 'Test & Safe Provider',
        serviceName: 'Test Service',
        bookingDate: new Date(),
        startTime: '10:00',
        endTime: '11:00',
        totalAmount: 50,
        bookingId: 'test-booking',
      });

      const sentEmail = mockResend.emails.send.mock.calls[0][0];
      
      // Should not contain unescaped script tags
      expect(sentEmail.html).not.toContain('<script>');
      expect(sentEmail.html).not.toContain('alert("xss")');
      
      // Should contain the escaped content
      expect(sentEmail.html).toContain('&lt;script&gt;');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing environment variables gracefully', async () => {
      delete process.env.RESEND_FROM_EMAIL;
      delete process.env.RESEND_REPLY_TO;

      // Should still work with defaults
      await sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'onboarding@resend.dev',
          replyTo: 'customer-support@projectecosystemapp.com',
        })
      );
    });

    it('should handle extremely long content', async () => {
      const longContent = 'A'.repeat(100000); // 100KB of content

      await sendBookingConfirmation({
        customerName: longContent,
        customerEmail: 'test@example.com',
        providerName: 'Test Provider',
        serviceName: 'Test Service',
        bookingDate: new Date(),
        startTime: '10:00',
        endTime: '11:00',
        totalAmount: 50,
        bookingId: 'test-booking',
      });

      expect(mockResend.emails.send).toHaveBeenCalled();
      const sentEmail = mockResend.emails.send.mock.calls[0][0];
      expect(sentEmail.html).toContain(longContent);
    });

    it('should handle special characters in email addresses', async () => {
      await sendEmail({
        to: 'user+test@example-domain.co.uk',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user+test@example-domain.co.uk',
        })
      );
    });

    it('should handle date formatting edge cases', async () => {
      // Test with different timezones and edge dates
      const edgeDates = [
        new Date('1970-01-01T00:00:00Z'), // Unix epoch
        new Date('2038-01-19T03:14:07Z'), // End of 32-bit time_t
        new Date('2024-02-29T12:00:00Z'), // Leap year
        new Date('2024-12-31T23:59:59Z'), // End of year
      ];

      for (const date of edgeDates) {
        await sendBookingConfirmation({
          customerName: 'Test User',
          customerEmail: 'test@example.com',
          providerName: 'Test Provider',
          serviceName: 'Test Service',
          bookingDate: date,
          startTime: '10:00',
          endTime: '11:00',
          totalAmount: 50,
          bookingId: 'test-booking',
        });

        const sentEmail = mockResend.emails.send.mock.calls[mockResend.emails.send.mock.calls.length - 1][0];
        expect(sentEmail.html).not.toContain('Invalid Date');
        expect(sentEmail.html).not.toContain('NaN');
      }
    });

    it('should handle network timeouts gracefully', async () => {
      mockResend.emails.send.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      await expect(sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      })).rejects.toThrow('Timeout');
    });
  });

  describe('Template Consistency', () => {
    it('should use consistent branding across all templates', async () => {
      const templates = [
        () => sendBookingConfirmation({
          customerName: 'Test', customerEmail: 'test@example.com', providerName: 'Provider',
          serviceName: 'Service', bookingDate: new Date(), startTime: '10:00', endTime: '11:00',
          totalAmount: 50, bookingId: 'booking-1'
        }),
        () => sendWelcomeEmail('test@example.com', 'Test', false),
        () => sendPaymentReceipt({
          customerName: 'Test', customerEmail: 'test@example.com', amount: 50,
          serviceName: 'Service', providerName: 'Provider', paymentDate: new Date(),
          paymentIntentId: 'pi_123', bookingId: 'booking-1'
        }),
      ];

      for (const template of templates) {
        await template();
        const sentEmail = mockResend.emails.send.mock.calls[mockResend.emails.send.mock.calls.length - 1][0];
        
        // Check for consistent branding elements
        expect(sentEmail.html).toContain('Ecosystem Marketplace');
        expect(sentEmail.html).toContain('Your trusted marketplace');
        expect(sentEmail.html).toContain('font-family: Arial, sans-serif');
      }
    });

    it('should include proper unsubscribe information', async () => {
      await sendWelcomeEmail('test@example.com', 'Test User', false);

      const sentEmail = mockResend.emails.send.mock.calls[0][0];
      expect(sentEmail.html).toContain('This is an automated email');
    });
  });
});