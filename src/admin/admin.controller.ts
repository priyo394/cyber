import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard) // টোকেন এবং রোল দুটোই চেক করবে
@Roles('ADMIN') // শুধুমাত্র ADMIN রোল থাকলেই ঢুকতে পারবে
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  getAllUsers() {
    return this.adminService.getAllUsers();
  }

  @Patch('users/:id/block')
  toggleBlockUser(@Param('id') id: string) {
    return this.adminService.toggleBlockUser(id);
  }

  @Get('logs')
  getLoginLogs() {
    return this.adminService.getLoginLogs();
  }
}