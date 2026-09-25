import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  createPaymentOrderSchema,
  refundPaymentSchema,
  verifyPaymentSchema,
  type AuthUser,
} from '@campus-skill-exchange/contracts';
import type { FastifyRequest } from 'fastify';
import { ApiException } from '../../common/errors/api-exception';
import { ZodSchema } from '../../common/validation/zod-validation.pipe';
import { CurrentUser, Public } from '../auth/auth.decorators';
import { PaymentsService } from './payments.service';

class CreatePaymentOrderDto {
  declare sessionId: string;
  declare termsVersion: string;
  declare termsAccepted: true;
}
ZodSchema(createPaymentOrderSchema)(CreatePaymentOrderDto);
class VerifyPaymentDto {
  declare paymentId: string;
  declare providerOrderId: string;
  declare providerPaymentId: string;
  declare signature: string;
}
ZodSchema(verifyPaymentSchema)(VerifyPaymentDto);
class RefundPaymentDto {
  declare amountPaise?: number;
  declare reason: string;
}
ZodSchema(refundPaymentSchema)(RefundPaymentDto);

const idPipe = new ParseUUIDPipe({ version: '4' });

@ApiTags('payments')
@Controller({ path: 'payments', version: '1' })
export class PaymentsController {
  constructor(@Inject(PaymentsService) private readonly service: PaymentsService) {}

  @Post('order')
  @HttpCode(HttpStatus.CREATED)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Create a verified INR Razorpay order for a paid Session' })
  async createOrder(@CurrentUser() actor: AuthUser, @Body() body: CreatePaymentOrderDto) {
    return { success: true, data: await this.service.createOrder(actor, body) };
  }

  @Post('verify')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Verify a Razorpay payment signature server-side' })
  async verify(@CurrentUser() actor: AuthUser, @Body() body: VerifyPaymentDto) {
    return { success: true, data: await this.service.verify(actor, body) };
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process a signed Razorpay webhook idempotently' })
  async webhook(@Req() request: RawBodyRequest<FastifyRequest>) {
    const signature = request.headers['x-razorpay-signature'];
    if (typeof signature !== 'string' || !request.rawBody) {
      throw new ApiException(400, 'VALIDATION_ERROR', 'The webhook signature is required.');
    }
    return { success: true, data: await this.service.handleWebhook(request.rawBody, signature) };
  }

  @Get('history')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'List the current User payment history' })
  async history(@CurrentUser() actor: AuthUser) {
    return { success: true, data: await this.service.history(actor) };
  }

  @Post(':paymentId/refund')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Request a verified Razorpay refund' })
  async refund(
    @CurrentUser() actor: AuthUser,
    @Param('paymentId', idPipe) paymentId: string,
    @Body() body: RefundPaymentDto,
  ) {
    return { success: true, data: await this.service.requestRefund(actor, paymentId, body) };
  }

  @Get(':paymentId')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Get a safe payment record' })
  async get(@CurrentUser() actor: AuthUser, @Param('paymentId', idPipe) paymentId: string) {
    return { success: true, data: await this.service.get(actor, paymentId) };
  }
}
